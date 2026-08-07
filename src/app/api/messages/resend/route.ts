import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";
import { requireActiveExhibition } from "@/lib/exhibition";
import { hasPermission } from "@/lib/rbac";
import { sendInviteWhatsApp } from "@/lib/invite-whatsapp";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { OutboundMessageType } from "@/generated/prisma/enums";
import { parseSurveyConfig } from "@/lib/survey-questions";
import { buildSurveyMessage } from "@/lib/survey-message";
import { isValidSaudiMobile, MOBILE_ERROR, normalizeMobile } from "@/lib/mobile";

const schema = z.object({
  beneficiaryId: z.string().min(1),
  channel: z.enum(["INVITATION", "SURVEY"]),
  /** تأكيد إرسال الاستبيان رغم عدم وجود صرف */
  forceWithoutDispense: z.boolean().optional(),
});

/**
 * إعادة إرسال دعوة أو استبيان من سجل الرسائل — تراكمي O(1) لكل طلب.
 */
export async function POST(req: NextRequest) {
  const authz = await requireSession();
  if ("error" in authz) return authz.error;

  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  if (body.data.channel === "INVITATION" && !hasPermission(authz.role, "invites:manage")) {
    return NextResponse.json({ error: "لا تملك صلاحية إعادة إرسال الدعوة" }, { status: 403 });
  }
  if (body.data.channel === "SURVEY" && !hasPermission(authz.role, "survey:manage")) {
    return NextResponse.json({ error: "لا تملك صلاحية إعادة إرسال الاستبيان" }, { status: 403 });
  }

  let exhibition;
  try {
    exhibition = await requireActiveExhibition();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "لا يوجد معرض نشط" },
      { status: 400 },
    );
  }

  const beneficiary = await prisma.beneficiary.findUnique({
    where: { id: body.data.beneficiaryId },
    select: { id: true, name: true, mobile: true },
  });
  if (!beneficiary) {
    return NextResponse.json({ error: "المستفيد غير موجود" }, { status: 404 });
  }

  const mobile = normalizeMobile(beneficiary.mobile);
  if (!isValidSaudiMobile(mobile)) {
    return NextResponse.json(
      { error: MOBILE_ERROR, code: "INVALID_MOBILE" },
      { status: 400 },
    );
  }

  if (body.data.channel === "INVITATION") {
    const invite = await prisma.exhibitionInvite.findUnique({
      where: {
        exhibitionId_beneficiaryId: {
          exhibitionId: exhibition.id,
          beneficiaryId: beneficiary.id,
        },
      },
    });
    if (!invite?.invited) {
      return NextResponse.json(
        { error: "لا دعوة لهذا المستفيد — ادعُه من شاشة الدعوات أولاً" },
        { status: 404 },
      );
    }

    const send = await sendInviteWhatsApp({
      req,
      exhibition,
      beneficiary,
      qrToken: invite.qrToken,
      createdById: authz.userId,
    });

    await writeAuditLog({
      userId: authz.userId,
      action: "INVITE_RESEND",
      entityType: "OutboundMessage",
      entityId: beneficiary.id,
      meta: { source: "messages-log", status: send.status, reason: send.reason },
      status: send.status === "FAILED" ? "FAILED" : "SUCCESS",
      statusReason: send.reason,
    });

    return NextResponse.json({
      channel: "INVITATION",
      status: send.status,
      reason: send.reason,
      beneficiaryId: beneficiary.id,
    });
  }

  // SURVEY
  const dispense = await prisma.dispenseOrder.findFirst({
    where: { exhibitionId: exhibition.id, beneficiaryId: beneficiary.id },
    select: { id: true },
  });
  if (!dispense && !body.data.forceWithoutDispense) {
    return NextResponse.json(
      {
        error: "المستفيد لم يستلم قطعاً بعد",
        code: "NO_DISPENSE",
        needsConfirm: true,
        message:
          "لم يُسجَّل صرف لهذا المستفيد. هل تريد إرسال رابط الاستبيان رغم ذلك؟",
      },
      { status: 409 },
    );
  }

  const config = parseSurveyConfig(exhibition.settings?.surveyQuestionsJson);
  const msg = await sendWhatsAppMessage({
    exhibitionId: exhibition.id,
    beneficiaryId: beneficiary.id,
    mobile,
    body: buildSurveyMessage(beneficiary.name, exhibition.name, config.externalUrl),
    type: OutboundMessageType.SURVEY,
    createdById: authz.userId,
  });

  const status =
    msg.status === "FAILED" ? "FAILED" : msg.status === "STUBBED" ? "STUBBED" : "SENT";

  await writeAuditLog({
    userId: authz.userId,
    action: "SURVEY_BROADCAST",
    entityType: "OutboundMessage",
    entityId: beneficiary.id,
    meta: {
      source: "messages-log",
      status,
      forceWithoutDispense: Boolean(body.data.forceWithoutDispense),
      hasDispense: Boolean(dispense),
    },
    status: status === "FAILED" ? "FAILED" : "SUCCESS",
    statusReason: msg.errorMessage,
  });

  return NextResponse.json({
    channel: "SURVEY",
    status,
    reason: msg.errorMessage ?? null,
    beneficiaryId: beneficiary.id,
    forcedWithoutDispense: Boolean(body.data.forceWithoutDispense) && !dispense,
  });
}

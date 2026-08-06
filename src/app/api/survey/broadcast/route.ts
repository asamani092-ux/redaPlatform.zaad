import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";
import { statusFromSendCounts } from "@/lib/audit-status";
import { requireActiveExhibition } from "@/lib/exhibition";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { OutboundMessageType } from "@/generated/prisma/enums";
import { parseSurveyConfig } from "@/lib/survey-questions";
import { buildSurveyMessage } from "@/lib/survey-message";

const schema = z.object({
  audience: z.enum(["attended", "received"]),
});

/**
 * إرسال رابط الاستبيان جماعياً: لكل الحضور أو لكل من استلم قطعاً.
 * O(n) بعدد المستهدفين — الرسائل تُسجل في OutboundMessage.
 */
export async function POST(req: NextRequest) {
  const authz = await requirePermission("survey:manage");
  if ("error" in authz) return authz.error;

  let exhibition;
  try {
    exhibition = await requireActiveExhibition();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "لا يوجد معرض نشط" },
      { status: 400 },
    );
  }

  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "حدد الفئة: الحضور أو المستلمون" }, { status: 400 });
  }

  const config = parseSurveyConfig(exhibition.settings?.surveyQuestionsJson);

  const beneficiarySelect = {
    id: true,
    name: true,
    mobile: true,
  } as const;

  const rawList =
    body.data.audience === "attended"
      ? (
          await prisma.attendance.findMany({
            where: { exhibitionId: exhibition.id },
            select: { beneficiary: { select: beneficiarySelect } },
          })
        ).map((a) => a.beneficiary)
      : (
          await prisma.dispenseOrder.findMany({
            where: { exhibitionId: exhibition.id },
            distinct: ["beneficiaryId"],
            select: { beneficiary: { select: beneficiarySelect } },
          })
        ).map((d) => d.beneficiary);

  // إزالة التكرار إن وُجد (حضور مكرر أو صرف متكرر) — O(n)
  const seen = new Set<string>();
  const beneficiaries = rawList.filter((b) => {
    if (!b || seen.has(b.id)) return false;
    seen.add(b.id);
    return true;
  });

  let sent = 0;
  let failed = 0;
  let stubbed = 0;
  const errors: Array<{
    beneficiaryId: string;
    beneficiaryName: string;
    mobile: string;
    reason: string;
  }> = [];

  for (const b of beneficiaries) {
    if (!b.mobile) {
      failed++;
      errors.push({
        beneficiaryId: b.id,
        beneficiaryName: b.name,
        mobile: "",
        reason: "لا يوجد رقم جوال",
      });
      continue;
    }
    const msg = await sendWhatsAppMessage({
      exhibitionId: exhibition.id,
      beneficiaryId: b.id,
      mobile: b.mobile,
      body: buildSurveyMessage(b.name, exhibition.name, config.externalUrl),
      type: OutboundMessageType.SURVEY,
      createdById: authz.userId,
    });
    if (msg.status === "FAILED") {
      failed++;
      errors.push({
        beneficiaryId: b.id,
        beneficiaryName: b.name,
        mobile: b.mobile,
        reason: msg.errorMessage || "فشل إرسال واتساب",
      });
    } else if (msg.status === "STUBBED") {
      stubbed++;
    } else {
      sent++;
    }
  }

  const status = statusFromSendCounts({ sent, failed, stubbed });
  const statusReason =
    errors.length > 0
      ? errors
          .slice(0, 5)
          .map((e) => `${e.beneficiaryName}: ${e.reason}`)
          .join(" | ")
      : sent + stubbed === 0
        ? "لا مستهدفين للإرسال"
        : null;

  await writeAuditLog({
    userId: authz.userId,
    action: "SURVEY_BROADCAST",
    entityType: "SurveyResponse",
    entityId: exhibition.id,
    meta: {
      audience: body.data.audience,
      sent,
      failed,
      stubbed,
      errors: errors.slice(0, 20),
    },
    status,
    statusReason,
  });

  return NextResponse.json({
    sent,
    failed,
    stubbed,
    errors,
    audience: body.data.audience,
    status,
    statusReason,
  });
}

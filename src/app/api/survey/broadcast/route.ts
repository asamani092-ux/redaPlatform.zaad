import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";
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
  const exhibition = await requireActiveExhibition();

  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "حدد الفئة: الحضور أو المستلمون" }, { status: 400 });
  }

  const config = parseSurveyConfig(exhibition.settings?.surveyQuestionsJson);

  const beneficiaries =
    body.data.audience === "attended"
      ? (
          await prisma.attendance.findMany({
            where: { exhibitionId: exhibition.id },
            include: { beneficiary: true },
          })
        ).map((a) => a.beneficiary)
      : (
          await prisma.dispenseOrder.findMany({
            where: { exhibitionId: exhibition.id },
            include: { beneficiary: true },
          })
        ).map((d) => d.beneficiary);

  let sent = 0;
  for (const b of beneficiaries) {
    if (!b.mobile) continue;
    await sendWhatsAppMessage({
      exhibitionId: exhibition.id,
      beneficiaryId: b.id,
      mobile: b.mobile,
      body: buildSurveyMessage(b.name, exhibition.name, config.externalUrl),
      type: OutboundMessageType.SURVEY,
      createdById: authz.userId,
    });
    sent++;
  }

  await writeAuditLog({
    userId: authz.userId,
    action: "SURVEY_BROADCAST",
    entityType: "SurveyResponse",
    entityId: exhibition.id,
    meta: { audience: body.data.audience, sent },
  });

  return NextResponse.json({ sent, audience: body.data.audience });
}

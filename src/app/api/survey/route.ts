import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";
import { requireActiveExhibition } from "@/lib/exhibition";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { OutboundMessageType } from "@/generated/prisma/enums";

const submitSchema = z.object({
  beneficiaryId: z.string(),
  answers: z.record(z.string(), z.unknown()),
  sendLink: z.boolean().optional(),
});

export async function GET() {
  const authz = await requirePermission("survey:manage");
  if ("error" in authz) return authz.error;
  const exhibition = await requireActiveExhibition();
  const responses = await prisma.surveyResponse.findMany({
    where: { exhibitionId: exhibition.id },
    include: { beneficiary: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({
    questions: exhibition.settings?.surveyQuestionsJson ?? [],
    responses,
  });
}

export async function POST(req: NextRequest) {
  const authz = await requirePermission("survey:manage");
  if ("error" in authz) return authz.error;
  const exhibition = await requireActiveExhibition();
  const body = submitSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const beneficiary = await prisma.beneficiary.findUnique({
    where: { id: body.data.beneficiaryId },
  });
  if (!beneficiary) {
    return NextResponse.json({ error: "المستفيد غير موجود" }, { status: 404 });
  }

  if (body.data.sendLink) {
    const msg = await sendWhatsAppMessage({
      exhibitionId: exhibition.id,
      beneficiaryId: beneficiary.id,
      mobile: beneficiary.mobile,
      body: `مرحباً ${beneficiary.name}، نرجو تقييم زيارتك لمعرض رداء عبر المنصة.`,
      type: OutboundMessageType.SURVEY,
      createdById: authz.userId,
    });
    return NextResponse.json({ message: msg });
  }

  const response = await prisma.surveyResponse.upsert({
    where: {
      exhibitionId_beneficiaryId: {
        exhibitionId: exhibition.id,
        beneficiaryId: body.data.beneficiaryId,
      },
    },
    update: { answersJson: body.data.answers as Prisma.InputJsonValue },
    create: {
      exhibitionId: exhibition.id,
      beneficiaryId: body.data.beneficiaryId,
      answersJson: body.data.answers as Prisma.InputJsonValue,
    },
  });

  await writeAuditLog({
    userId: authz.userId,
    action: "SURVEY_SUBMIT",
    entityType: "SurveyResponse",
    entityId: response.id,
    after: response,
  });

  return NextResponse.json({ data: response });
}

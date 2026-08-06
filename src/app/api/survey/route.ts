import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";
import { requireActiveExhibition } from "@/lib/exhibition";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { OutboundMessageType } from "@/generated/prisma/enums";
import { parseSurveyConfig } from "@/lib/survey-questions";
import { buildSurveyMessage } from "@/lib/survey-message";
import { buildPageMeta, parsePageParams } from "@/lib/pagination";

const submitSchema = z.object({
  beneficiaryId: z.string(),
  answers: z.record(z.string(), z.unknown()),
  sendLink: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
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
  const { page, pageSize, skip, take } = parsePageParams(req.nextUrl.searchParams);
  const where = { exhibitionId: exhibition.id };
  const [total, responses] = await Promise.all([
    prisma.surveyResponse.count({ where }),
    prisma.surveyResponse.findMany({
      where,
      include: { beneficiary: true },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
  ]);
  const config = parseSurveyConfig(exhibition.settings?.surveyQuestionsJson);
  return NextResponse.json({
    questions: config.questions,
    externalUrl: config.externalUrl,
    autoSendOnDispense: config.autoSendOnDispense,
    responses,
    ...buildPageMeta(page, pageSize, total),
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
    if (!beneficiary.mobile) {
      return NextResponse.json({ error: "لا يوجد رقم جوال للمستفيد" }, { status: 400 });
    }
    const config = parseSurveyConfig(exhibition.settings?.surveyQuestionsJson);
    const msg = await sendWhatsAppMessage({
      exhibitionId: exhibition.id,
      beneficiaryId: beneficiary.id,
      mobile: beneficiary.mobile,
      body: buildSurveyMessage(beneficiary.name, exhibition.name, config.externalUrl),
      type: OutboundMessageType.SURVEY,
      createdById: authz.userId,
    });
    if (msg.status === "FAILED") {
      return NextResponse.json(
        { error: `فشل الإرسال: ${msg.errorMessage || "خطأ غير معروف"}`, status: "FAILED" },
        { status: 502 },
      );
    }
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

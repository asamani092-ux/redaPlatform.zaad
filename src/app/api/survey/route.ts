import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";
import { requireActiveExhibition } from "@/lib/exhibition";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { OutboundMessageType } from "@/generated/prisma/enums";
import {
  findSurvey,
  parseSurveyCatalog,
  SURVEY_AUDIENCE_OPTIONS,
} from "@/lib/survey-questions";
import { buildSurveyMessage } from "@/lib/survey-message";
import { buildPageMeta, parsePageParams } from "@/lib/pagination";

const submitSchema = z.object({
  beneficiaryId: z.string(),
  surveyId: z.string().optional(),
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
  const catalog = parseSurveyCatalog(exhibition.settings?.surveyQuestionsJson);
  const surveyIdParam = req.nextUrl.searchParams.get("surveyId");
  const selected =
    findSurvey(catalog, surveyIdParam) ?? catalog.surveys[0] ?? null;

  const { page, pageSize, skip, take } = parsePageParams(req.nextUrl.searchParams);
  const where = {
    exhibitionId: exhibition.id,
    ...(selected ? { surveyId: selected.id } : {}),
  };
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

  return NextResponse.json({
    surveys: catalog.surveys,
    audienceOptions: SURVEY_AUDIENCE_OPTIONS,
    selectedSurveyId: selected?.id ?? null,
    questions: selected?.questions ?? [],
    externalUrl: selected?.externalUrl ?? null,
    autoSendOnDispense: selected?.autoSendOnDispense ?? false,
    audience: selected?.audience ?? null,
    title: selected?.title ?? null,
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

  const catalog = parseSurveyCatalog(exhibition.settings?.surveyQuestionsJson);
  const survey = findSurvey(catalog, body.data.surveyId);
  if (!survey) {
    return NextResponse.json({ error: "الاستبيان غير موجود" }, { status: 404 });
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
    const msg = await sendWhatsAppMessage({
      exhibitionId: exhibition.id,
      beneficiaryId: beneficiary.id,
      mobile: beneficiary.mobile,
      body: buildSurveyMessage(
        beneficiary.name,
        exhibition.name,
        survey.externalUrl,
        survey.title,
      ),
      type: OutboundMessageType.SURVEY,
      createdById: authz.userId,
    });
    if (msg.status === "FAILED") {
      return NextResponse.json(
        { error: `فشل الإرسال: ${msg.errorMessage || "خطأ غير معروف"}`, status: "FAILED" },
        { status: 502 },
      );
    }
    return NextResponse.json({ message: msg, surveyId: survey.id });
  }

  const response = await prisma.surveyResponse.upsert({
    where: {
      exhibitionId_beneficiaryId_surveyId: {
        exhibitionId: exhibition.id,
        beneficiaryId: body.data.beneficiaryId,
        surveyId: survey.id,
      },
    },
    update: { answersJson: body.data.answers as Prisma.InputJsonValue },
    create: {
      exhibitionId: exhibition.id,
      beneficiaryId: body.data.beneficiaryId,
      surveyId: survey.id,
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

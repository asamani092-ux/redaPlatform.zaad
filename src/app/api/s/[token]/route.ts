import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  findSurvey,
  normalizeSurveyAnswer,
  parseSurveyCatalog,
  validateSurveyAnswer,
} from "@/lib/survey-questions";
import { resolveSurveyMode, verifySurveyToken } from "@/lib/survey-link";

type Ctx = { params: Promise<{ token: string }> };

async function loadSurveyContext(token: string) {
  const payload = verifySurveyToken(token);
  if (!payload) {
    return { error: NextResponse.json({ error: "رابط غير صالح" }, { status: 400 }) };
  }

  const exhibition = await prisma.exhibition.findUnique({
    where: { id: payload.exhibitionId },
    include: { settings: true },
  });
  if (!exhibition) {
    return { error: NextResponse.json({ error: "المعرض غير موجود" }, { status: 404 }) };
  }

  const catalog = parseSurveyCatalog(exhibition.settings?.surveyQuestionsJson);
  const survey = findSurvey(catalog, payload.surveyId);
  if (!survey || !survey.active) {
    return {
      error: NextResponse.json(
        { error: "الاستبيان غير موجود أو غير مفعّل" },
        { status: 404 },
      ),
    };
  }

  const mode = resolveSurveyMode(survey);
  if (mode !== "internal") {
    return {
      error: NextResponse.json(
        { error: "هذا الاستبيان لا يستخدم نموذجاً داخلياً" },
        { status: 400 },
      ),
    };
  }

  const beneficiary = await prisma.beneficiary.findUnique({
    where: { id: payload.beneficiaryId },
    select: { id: true, name: true },
  });
  if (!beneficiary) {
    return { error: NextResponse.json({ error: "المستفيد غير موجود" }, { status: 404 }) };
  }

  const existing = await prisma.surveyResponse.findUnique({
    where: {
      exhibitionId_beneficiaryId_surveyId: {
        exhibitionId: exhibition.id,
        beneficiaryId: beneficiary.id,
        surveyId: survey.id,
      },
    },
    select: { id: true },
  });

  return { exhibition, survey, beneficiary, existing, payload };
}

/** جلب أسئلة النموذج العام — بدون مصادقة. O(1) بعد الجلب. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params;
  const loaded = await loadSurveyContext(token);
  if ("error" in loaded && loaded.error) return loaded.error;

  const { exhibition, survey, beneficiary, existing } = loaded as Exclude<
    Awaited<ReturnType<typeof loadSurveyContext>>,
    { error: NextResponse }
  >;

  return NextResponse.json({
    title: survey.title,
    exhibitionName: exhibition.name,
    questions: survey.questions,
    beneficiaryName: beneficiary.name,
    alreadySubmitted: Boolean(existing),
  });
}

const submitSchema = z.object({
  answers: z.record(
    z.string(),
    z.union([
      z.string(),
      z.number(),
      z.record(z.string(), z.number()),
      z.object({
        choice: z.string(),
        otherText: z.string().optional(),
      }),
    ]),
  ),
});

/** حفظ إجابات النموذج العام — بدون مصادقة. O(n) للأسئلة. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params;
  const loaded = await loadSurveyContext(token);
  if ("error" in loaded && loaded.error) return loaded.error;

  const { exhibition, survey, beneficiary } = loaded as Exclude<
    Awaited<ReturnType<typeof loadSurveyContext>>,
    { error: NextResponse }
  >;

  const body = submitSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const answersJson: Record<string, unknown> = {};
  for (const q of survey.questions) {
    const raw = body.data.answers[q.id];
    const err = validateSurveyAnswer(q, raw);
    if (err) {
      return NextResponse.json({ error: err, questionId: q.id }, { status: 400 });
    }
    const normalized = normalizeSurveyAnswer(q, raw);
    if (normalized == null) {
      return NextResponse.json(
        { error: "يرجى الإجابة على جميع الأسئلة", questionId: q.id },
        { status: 400 },
      );
    }
    answersJson[q.id] = normalized;
  }

  const response = await prisma.surveyResponse.upsert({
    where: {
      exhibitionId_beneficiaryId_surveyId: {
        exhibitionId: exhibition.id,
        beneficiaryId: beneficiary.id,
        surveyId: survey.id,
      },
    },
    update: { answersJson: answersJson as Prisma.InputJsonValue },
    create: {
      exhibitionId: exhibition.id,
      beneficiaryId: beneficiary.id,
      surveyId: survey.id,
      answersJson: answersJson as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ ok: true, id: response.id });
}

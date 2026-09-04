import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findSurvey, parseSurveyCatalog } from "@/lib/survey-questions";
import { resolveSurveyMode } from "@/lib/survey-link";

type Ctx = { params: Promise<{ surveyId: string }> };

/**
 * بيانات معاينة الاستبيان العامة — بدون مصادقة.
 * لا يحفظ ردوداً؛ للتجربة من الجوال فقط. O(1) بعد الجلب.
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { surveyId } = await ctx.params;
  if (!surveyId?.trim()) {
    return NextResponse.json({ error: "معرّف الاستبيان مطلوب" }, { status: 400 });
  }

  const exhibition = await prisma.exhibition.findFirst({
    where: { active: true },
    include: { settings: true },
    orderBy: { createdAt: "desc" },
  });
  if (!exhibition) {
    return NextResponse.json({ error: "لا يوجد معرض نشط" }, { status: 404 });
  }

  const catalog = parseSurveyCatalog(exhibition.settings?.surveyQuestionsJson);
  const survey = findSurvey(catalog, surveyId);
  if (!survey || !survey.active) {
    return NextResponse.json(
      { error: "الاستبيان غير موجود أو غير مفعّل" },
      { status: 404 },
    );
  }

  const mode = resolveSurveyMode(survey);
  if (mode === "invalid") {
    return NextResponse.json(
      { error: "الاستبيان غير مكتمل — أضف أسئلة أو رابطاً خارجياً" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    mode,
    title: survey.title,
    exhibitionName: exhibition.name,
    questions: mode === "internal" ? survey.questions : [],
    externalUrl: mode === "external" ? survey.externalUrl : null,
  });
}

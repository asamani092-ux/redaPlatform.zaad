/** نص رسالة الاستبيان — يستخدم رابط النموذج الخارجي إن ضُبط — O(1) */
export function buildSurveyMessage(
  name: string,
  exhibitionName: string,
  externalUrl: string | null,
  surveyTitle?: string | null,
): string {
  const title = surveyTitle?.trim() || "استبيان";
  if (externalUrl) {
    return `مرحباً ${name}، نرجو تعبئة «${title}» الخاص بـ${exhibitionName} عبر الرابط: ${externalUrl}`;
  }
  return `مرحباً ${name}، نرجو تعبئة «${title}» الخاص بـ${exhibitionName} عبر المنصة.`;
}

/** رابط الاستبيان لقالب ZAD — O(1) */
export function resolveSurveyUrl(externalUrl: string | null | undefined): string {
  const fromSurvey = externalUrl?.trim();
  if (fromSurvey) return fromSurvey;
  const fromEnv = process.env.WHATSAPP_SURVEY_URL?.trim();
  if (fromEnv) return fromEnv;
  const origin = (process.env.NEXTAUTH_URL || process.env.AUTH_URL || "").replace(
    /\/$/,
    "",
  );
  return origin ? `${origin}/survey` : "https://example.invalid/survey";
}

/** متغيرات قالب الاستبيان: name, exhibition, survey_url — O(1) */
export function surveyTemplateParams(
  name: string,
  exhibitionName: string,
  externalUrl: string | null | undefined,
): string[] {
  return [name, exhibitionName, resolveSurveyUrl(externalUrl)];
}

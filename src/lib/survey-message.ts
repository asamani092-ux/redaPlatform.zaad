/** نص رسالة الاستبيان — يستخدم رابط التسليم النهائي (داخلي أو خارجي) — O(1) */
export function buildSurveyMessage(
  name: string,
  exhibitionName: string,
  surveyUrl: string | null,
  surveyTitle?: string | null,
): string {
  const title = surveyTitle?.trim() || "استبيان";
  if (surveyUrl?.trim()) {
    return `مرحباً ${name}، نرجو تعبئة «${title}» الخاص بـ${exhibitionName} عبر الرابط: ${surveyUrl.trim()}`;
  }
  return `مرحباً ${name}، نرجو تعبئة «${title}» الخاص بـ${exhibitionName} عبر المنصة.`;
}

/**
 * رابط قالب واتساب — يمرّر الرابط المحسوب مسبقاً دون تغيير هيكل القالب.
 * لا يسقط على /survey للطاقم. O(1).
 */
export function resolveSurveyUrl(surveyUrl: string | null | undefined): string {
  const direct = surveyUrl?.trim();
  if (direct) return direct;
  const fromEnv = process.env.WHATSAPP_SURVEY_URL?.trim();
  if (fromEnv) return fromEnv;
  return "https://example.invalid/survey";
}

/** متغيرات قالب الاستبيان: name, exhibition, survey_url — O(1) */
export function surveyTemplateParams(
  name: string,
  exhibitionName: string,
  surveyUrl: string | null | undefined,
): string[] {
  return [name, exhibitionName, resolveSurveyUrl(surveyUrl)];
}

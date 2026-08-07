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

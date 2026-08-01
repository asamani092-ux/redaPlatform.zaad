/** نص رسالة الاستبيان — يستخدم رابط النموذج الخارجي (قوقل/أوفيس فورم) إن ضُبط — O(1) */
export function buildSurveyMessage(
  name: string,
  exhibitionName: string,
  externalUrl: string | null,
): string {
  if (externalUrl) {
    return `مرحباً ${name}، نرجو تقييم زيارتك لـ${exhibitionName} عبر الرابط: ${externalUrl}`;
  }
  return `مرحباً ${name}، نرجو تقييم زيارتك لـ${exhibitionName} عبر المنصة.`;
}

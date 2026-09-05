/**
 * نص/متغيرات رسالة الاستبيان لواتساب.
 * Time: O(1) — Space: O(1).
 */

/** تنظيف متغير قالب ميتا: بلا أسطر جديدة أو مسافات زائدة — يمنع #132012 */
export function sanitizeWaTemplateParam(raw: string, maxLen = 1024): string {
  return raw
    .replace(/[\r\n\t]+/g, " ")
    .replace(/ {5,}/g, "    ")
    .trim()
    .slice(0, maxLen);
}

/** نص رسالة الاستبيان — يستخدم رابط التسليم النهائي (داخلي أو خارجي) */
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

/**
 * صورة هيدر قالب الاستبيان (ميتا يتوقع IMAGE مع القالب حتى لو «ثابتة» ظاهرياً).
 * الأولوية: SURVEY_HEADER → INVITE_HEADER → أصل التطبيق + invite-poster.jpeg
 */
export function resolveSurveyHeaderImageUrl(
  configured?: string | null,
): string | null {
  const fromArg = configured?.trim();
  if (fromArg) return fromArg;
  const surveyEnv = process.env.WHATSAPP_SURVEY_HEADER_IMAGE_URL?.trim();
  if (surveyEnv) return surveyEnv;
  const inviteEnv = process.env.WHATSAPP_INVITE_HEADER_IMAGE_URL?.trim();
  if (inviteEnv) return inviteEnv;
  const origin = (
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    ""
  ).replace(/\/$/, "");
  if (origin.startsWith("http")) {
    return `${origin}/invite-poster.jpeg`;
  }
  return null;
}

/** متغيرات قالب الاستبيان: name, exhibition, survey_url — O(1) */
export function surveyTemplateParams(
  name: string,
  exhibitionName: string,
  surveyUrl: string | null | undefined,
): string[] {
  return [
    sanitizeWaTemplateParam(name || "مستفيد"),
    sanitizeWaTemplateParam(exhibitionName || "المعرض"),
    sanitizeWaTemplateParam(resolveSurveyUrl(surveyUrl)),
  ];
}

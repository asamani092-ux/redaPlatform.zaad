/**
 * النصوص الافتراضية لرسائل الدعوة (قابلة للتعديل من الإعدادات).
 * الصورة تُرسل عبر هيدر القالب / mediaUrl — ليست جزءاً من النص.
 */

export const DEFAULT_INVITE_POSTER_TPL = `معرض رداء
يسر جمعية الزاد دعوتكم لزيارة {{exhibition}}، الذي يقدّم الملابس والأقمشة ضمن تجربة تسوّق منظمة ومتكاملة.
📍 الموقع: {{location}}
🕔 ساعات الزيارة: من 5:00 مساءً إلى 10:00 مساءً
التاريخ: {{date}}
الدخول مخصص للنساء فقط، ولا يسمح بدخول الأطفال.
معرض رداء | نحو عطاءٍ أكثر أثرًا`;

export const DEFAULT_INVITE_QR_TPL =
  "عند الحضور للمعرض إبراز الباركود رجاءً لموظفة الاستقبال";

/** استبدال متغيرات القالب — O(طول النص) */
export function fillInviteTpl(
  tpl: string,
  vars: {
    name: string;
    exhibition: string;
    date: string;
    location: string;
    qr?: string;
    qrUrl?: string;
  },
): string {
  return tpl
    .replaceAll("{{name}}", vars.name)
    .replaceAll("{{exhibition}}", vars.exhibition)
    .replaceAll("{{date}}", vars.date)
    .replaceAll("{{location}}", vars.location)
    .replaceAll("{{qr}}", vars.qr ?? "")
    .replaceAll("{{qr_url}}", vars.qrUrl ?? "");
}

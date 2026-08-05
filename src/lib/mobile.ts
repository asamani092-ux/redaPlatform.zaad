/**
 * تطبيع وتحقق جوال سعودي 05xxxxxxxx — O(n) على طول النص.
 */
export function normalizeMobile(raw: string): string {
  let m = raw
    .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (c) => String(c.charCodeAt(0) - 0x06F0))
    .replace(/[^\d+]/g, "");
  if (m.startsWith("+966")) m = `0${m.slice(4)}`;
  if (m.startsWith("966") && m.length >= 12) m = `0${m.slice(3)}`;
  return m;
}

export function isValidSaudiMobile(raw: string): boolean {
  return /^05\d{8}$/.test(normalizeMobile(raw));
}

export const MOBILE_ERROR = "رقم الجوال غير صالح — الصيغة: 05xxxxxxxx";

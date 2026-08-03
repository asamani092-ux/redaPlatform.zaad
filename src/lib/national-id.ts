/**
 * تطبيع رقم الهوية: أرقام عربية/فارسية → لاتينية، ثم أرقام فقط — O(n).
 */
export function normalizeNationalId(raw: string): string {
  return raw
    .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (c) => String(c.charCodeAt(0) - 0x06F0))
    .replace(/\D/g, "");
}

/**
 * رقم الهوية مقبول: من 10 إلى 14 خانة رقمية — O(1).
 */
export function isValidNationalId(raw: string): boolean {
  const id = normalizeNationalId(raw);
  return /^\d{10,14}$/.test(id);
}

/** توافق خلفي مع الاستدعاءات القديمة */
export function isValidSaudiNationalId(raw: string): boolean {
  return isValidNationalId(raw);
}

export const NATIONAL_ID_ERROR =
  "رقم الهوية غير صالح — يجب أن يكون من 10 إلى 14 رقماً";

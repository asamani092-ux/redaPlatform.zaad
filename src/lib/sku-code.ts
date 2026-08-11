/**
 * رموز أصناف المخزون — 4 أو 5 أرقام، فريدة داخل المعرض.
 * Time: O(1) توليد؛ Space: O(1).
 */

export function isValidSkuCode(raw: string): boolean {
  return /^\d{4,5}$/.test(raw.trim());
}

/** يولّد الرمز التالي بعد أعلى رقم موجود (يبدأ من 1100). */
export function nextSkuCode(existingCodes: string[]): string {
  let max = 1099;
  for (const c of existingCodes) {
    const n = Number.parseInt(c, 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  const next = max + 1;
  if (next > 99999) {
    throw new Error("لا يمكن توليد رمز صنف جديد — تم استنفاد النطاق");
  }
  return next <= 9999 ? String(next).padStart(4, "0") : String(next);
}

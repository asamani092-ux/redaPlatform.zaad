/**
 * توحيد الأرقام المدخلة: تحويل الأرقام العربية/الفارسية إلى ASCII حتى لا
 * تتعطل حقول الأرقام مع لوحات المفاتيح العربية — O(n) بطول النص.
 */
const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const EXTENDED_INDIC = "۰۱۲۳۴۵۶۷۸۹";

export function normalizeDigits(input: string): string {
  let out = "";
  for (const ch of input) {
    const a = ARABIC_INDIC.indexOf(ch);
    if (a >= 0) {
      out += String(a);
      continue;
    }
    const e = EXTENDED_INDIC.indexOf(ch);
    if (e >= 0) {
      out += String(e);
      continue;
    }
    out += ch === "٫" ? "." : ch;
  }
  return out;
}

/** إبقاء الأرقام والنقطة فقط (لحقل كمية) — O(n) */
export function sanitizeNumericInput(input: string, allowDecimal = true): string {
  const normalized = normalizeDigits(input);
  const re = allowDecimal ? /[^0-9.]/g : /[^0-9]/g;
  let cleaned = normalized.replace(re, "");
  if (allowDecimal) {
    const firstDot = cleaned.indexOf(".");
    if (firstDot >= 0) {
      cleaned =
        cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replaceAll(".", "");
    }
  }
  return cleaned;
}

export function toIntOrNull(input: string): number | null {
  const s = sanitizeNumericInput(input, false);
  if (!s) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}

export function toNumberOrNull(input: string): number | null {
  const s = sanitizeNumericInput(input, true);
  if (!s || s === ".") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

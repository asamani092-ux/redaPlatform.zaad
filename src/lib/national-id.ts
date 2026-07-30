/** تحقق هوية سعودية: 10 أرقام + خوارزمية Luhn المعدّلة — O(1) زمن ومساحة */
export function isValidSaudiNationalId(raw: string): boolean {
  const id = raw.trim();
  if (!/^[12]\d{9}$/.test(id)) return false;

  const digits = id.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    if (i % 2 === 0) {
      const doubled = digits[i]! * 2;
      sum += Math.floor(doubled / 10) + (doubled % 10);
    } else {
      sum += digits[i]!;
    }
  }
  return sum % 10 === 0;
}

export function normalizeNationalId(raw: string): string {
  return raw.replace(/\s+/g, "").trim();
}

/** أيام المعرض بتوقيت الرياض — اشتقاق قائمة الأيام من فترة المعرض */

export const RIYADH_TIME_ZONE = "Asia/Riyadh";

/** حد أعلى لعدد الأيام المشتقة — حماية من فترة مُدخلة بالخطأ */
export const MAX_EXHIBITION_DAYS = 62;

const DAY_MS = 86_400_000;

const riyadhDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: RIYADH_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export type ExhibitionDay = {
  /** ترتيب اليوم داخل المعرض ابتداءً من 1 */
  dayIndex: number;
  /** مفتاح اليوم التقويمي بتوقيت الرياض YYYY-MM-DD */
  dateKey: string;
  /** تسمية عربية للعرض */
  label: string;
};

/** مفتاح اليوم التقويمي بتوقيت الرياض — O(1) */
export function riyadhDateKey(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = riyadhDateFormatter.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  if (!year || !month || !day) return "";
  return `${year}-${month}-${day}`;
}

export function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function exhibitionDayLabel(dayIndex: number): string {
  return `اليوم ${dayIndex}`;
}

/**
 * اشتقاق أيام المعرض التقويمية بين البداية والنهاية (شاملة الطرفين) بتوقيت الرياض.
 * Time: O(d) حيث d = عدد الأيام؛ Space: O(d).
 */
export function exhibitionDays(input: {
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
}): ExhibitionDay[] {
  const startKey = riyadhDateKey(input.startsAt);
  if (!startKey) return [];
  const endKey = riyadhDateKey(input.endsAt) || startKey;
  if (endKey < startKey) return [];

  // حساب تقويمي بحت: مرساة UTC لمفتاح اليوم ثم زيادة يوم كامل في كل خطوة
  const startMs = Date.parse(`${startKey}T00:00:00Z`);
  const endMs = Date.parse(`${endKey}T00:00:00Z`);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return [];

  const days: ExhibitionDay[] = [];
  for (
    let ms = startMs, i = 1;
    ms <= endMs && i <= MAX_EXHIBITION_DAYS;
    ms += DAY_MS, i++
  ) {
    const dateKey = new Date(ms).toISOString().slice(0, 10);
    days.push({ dayIndex: i, dateKey, label: exhibitionDayLabel(i) });
  }
  return days;
}

/** إيجاد يوم المعرض من مفتاح التاريخ أو ترتيب اليوم — O(d) */
export function findExhibitionDay(
  days: ExhibitionDay[],
  selector: { dateKey?: string | null; dayIndex?: number | null },
): ExhibitionDay | null {
  if (selector.dateKey) {
    return days.find((d) => d.dateKey === selector.dateKey) ?? null;
  }
  if (selector.dayIndex != null) {
    return days.find((d) => d.dayIndex === selector.dayIndex) ?? null;
  }
  return null;
}

/**
 * حدود يوم تقويمي بتوقيت الرياض كفاصل نصف مفتوح [start, end) بالتوقيت العالمي.
 * الرياض UTC+3 طوال السنة (بدون توقيت صيفي). Time/Space: O(1).
 */
export function riyadhDayBounds(dateKey: string): { start: Date; end: Date } | null {
  if (!isDateKey(dateKey)) return null;
  const start = new Date(`${dateKey}T00:00:00+03:00`);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + DAY_MS);
  return { start, end };
}


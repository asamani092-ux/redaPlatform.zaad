/** مقاييس تقارير موسّعة — نسب، أفراد مستلِمون، صرف متكرر، توزيع الساعة */

import { householdSize } from "@/lib/report-metrics";
import { RIYADH_TIME_ZONE } from "@/lib/exhibition-days";
// householdSize: المستفيد + التابعون

/** نسبة مئوية لمنزلة عشرية واحدة — O(1) */
export function pctRate(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

/** أسر حضرت ولم تستلم — لا سالب — O(1) */
export function attendedNotReceivedCount(
  attendedFamilies: number,
  receivedFamilies: number,
): number {
  return Math.max(0, attendedFamilies - receivedFamilies);
}

/** مجموع أحجام الأسر من أعداد التابعين — O(n) */
export function sumIndividualsFromDependents(
  dependentsCounts: number[],
): number {
  let total = 0;
  for (const d of dependentsCounts) total += householdSize(d);
  return total;
}

/**
 * عدد الأسر التي لها أكثر من أمر صرف.
 * input: عدد الأوامر لكل مستفيد — Time: O(n)، Space: O(1)
 */
export function countRepeatDispenseFamilies(
  orderCountsPerBeneficiary: number[],
): number {
  let n = 0;
  for (const c of orderCountsPerBeneficiary) {
    if (c > 1) n += 1;
  }
  return n;
}

const riyadhHourFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: RIYADH_TIME_ZONE,
  hour: "2-digit",
  hour12: false,
});

/** ساعة الرياض 0..23 من تاريخ — O(1) */
export function riyadhHour(value: Date | string): number | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const hourPart = riyadhHourFormatter
    .formatToParts(date)
    .find((p) => p.type === "hour")?.value;
  if (hourPart == null) return null;
  const h = Number(hourPart);
  // en-GB قد يعيد 24 لمنتصف الليل
  if (h === 24) return 0;
  if (!Number.isInteger(h) || h < 0 || h > 23) return null;
  return h;
}

/**
 * توزيع الحضور على 24 ساعة بتوقيت الرياض.
 * Time: O(n)، Space: O(1) للمصفوفة الثابتة.
 */
export function buildAttendanceByHour(
  checkedInAts: Array<Date | string>,
): number[] {
  const buckets = Array.from({ length: 24 }, () => 0);
  for (const ts of checkedInAts) {
    const h = riyadhHour(ts);
    if (h == null) continue;
    buckets[h] += 1;
  }
  return buckets;
}

export type AttendanceHourRow = { hour: number; count: number; label: string };

/** صفوف ساعة للعرض — O(24) */
export function attendanceByHourRows(buckets: number[]): AttendanceHourRow[] {
  return buckets.map((count, hour) => ({
    hour,
    count,
    label: `${String(hour).padStart(2, "0")}:00`,
  }));
}

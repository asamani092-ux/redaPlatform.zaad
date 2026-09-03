/** ملخص مؤشرات الحضور ضمن نطاق (إجمالي أو يوم) — أسر وأفراد */

/**
 * الحضور من الأسر = عدد سجلات الحضور؛
 * الحضور من الأفراد = Σ(1 + dependentsCount) لنفس السجلات.
 * Time: O(n) — Space: O(1).
 */
export function countAttendanceFamiliesAndIndividuals(
  dependentsCounts: number[],
): { attendedFamilies: number; attendedIndividuals: number } {
  let attendedIndividuals = 0;
  for (const deps of dependentsCounts) {
    attendedIndividuals += 1 + Math.max(0, deps);
  }
  return {
    attendedFamilies: dependentsCounts.length,
    attendedIndividuals,
  };
}

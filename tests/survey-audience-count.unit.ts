/**
 * عدّ مستهدفي فئة الاستبيان.
 * Time: O(n) عبر resolve — هنا نختبر التجميع فقط ببيانات وهمية محلية.
 */
import assert from "node:assert/strict";

function tally(list: Array<{ mobile: string }>) {
  let withMobile = 0;
  for (const b of list) {
    if (b.mobile?.trim()) withMobile++;
  }
  return {
    total: list.length,
    withMobile,
    withoutMobile: list.length - withMobile,
  };
}

assert.deepEqual(tally([{ mobile: "0500000001" }, { mobile: "" }, { mobile: "0500000002" }]), {
  total: 3,
  withMobile: 2,
  withoutMobile: 1,
});
assert.deepEqual(tally([]), { total: 0, withMobile: 0, withoutMobile: 0 });

console.log("survey-audience-count.unit: ok");

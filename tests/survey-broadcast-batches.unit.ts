/**
 * تقسيم دفعات بث الاستبيان + استبعاد المُرسل لهم (منطق نقي).
 * Time: O(n) — Space: O(n).
 */
import assert from "node:assert/strict";
import {
  SURVEY_BROADCAST_BATCH_SIZE,
  buildSurveyBroadcastBatches,
  sliceSurveyBroadcastBatch,
} from "../src/lib/survey-broadcast-batches";

assert.equal(SURVEY_BROADCAST_BATCH_SIZE, 200);

assert.deepEqual(buildSurveyBroadcastBatches(0), []);
assert.deepEqual(buildSurveyBroadcastBatches(1), [{ index: 0, size: 1 }]);
assert.deepEqual(buildSurveyBroadcastBatches(200), [{ index: 0, size: 200 }]);
assert.deepEqual(buildSurveyBroadcastBatches(201), [
  { index: 0, size: 200 },
  { index: 1, size: 1 },
]);
assert.deepEqual(buildSurveyBroadcastBatches(450), [
  { index: 0, size: 200 },
  { index: 1, size: 200 },
  { index: 2, size: 50 },
]);
assert.deepEqual(buildSurveyBroadcastBatches(1184), [
  { index: 0, size: 200 },
  { index: 1, size: 200 },
  { index: 2, size: 200 },
  { index: 3, size: 200 },
  { index: 4, size: 200 },
  { index: 5, size: 184 },
]);

const ids = Array.from({ length: 450 }, (_, i) => `b${i}`);
assert.deepEqual(
  sliceSurveyBroadcastBatch(ids, 0).map((x) => x),
  ids.slice(0, 200),
);
assert.deepEqual(sliceSurveyBroadcastBatch(ids, 1), ids.slice(200, 400));
assert.deepEqual(sliceSurveyBroadcastBatch(ids, 2), ids.slice(400, 450));
assert.deepEqual(sliceSurveyBroadcastBatch(ids, 3), []);
assert.deepEqual(sliceSurveyBroadcastBatch(ids, -1), []);

/** محاكاة استبعاد من أُرسل لهم */
function remainingTargets(
  audience: string[],
  alreadySent: Set<string>,
  includePreviouslySent: boolean,
) {
  if (includePreviouslySent) return audience.slice();
  return audience.filter((id) => !alreadySent.has(id));
}

const audience = ["a", "b", "c", "d", "e"];
const sent = new Set(["a", "c"]);
assert.deepEqual(remainingTargets(audience, sent, false), ["b", "d", "e"]);
assert.deepEqual(remainingTargets(audience, sent, true), audience);
assert.deepEqual(
  buildSurveyBroadcastBatches(remainingTargets(audience, sent, false).length, 2),
  [
    { index: 0, size: 2 },
    { index: 1, size: 1 },
  ],
);

console.log("survey-broadcast-batches.unit: ok");

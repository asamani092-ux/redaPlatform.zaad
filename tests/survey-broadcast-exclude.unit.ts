/**
 * استبعاد المُرسل لهم حسب surveyId في payloadJson.
 * Time: O(n) — Space: O(n).
 */
import assert from "node:assert/strict";
import {
  excludePreviouslySentTargets,
  surveyIdFromPayload,
} from "../src/lib/survey-broadcast-exclude";

assert.equal(surveyIdFromPayload(null), null);
assert.equal(surveyIdFromPayload({}), null);
assert.equal(surveyIdFromPayload({ surveyId: "  " }), null);
assert.equal(surveyIdFromPayload({ surveyId: "s1" }), "s1");

const withMobile = [
  { id: "a", name: "أ", mobile: "0500000001" },
  { id: "b", name: "ب", mobile: "0500000002" },
  { id: "c", name: "ج", mobile: "0500000003" },
  { id: "d", name: "د", mobile: "0500000004" },
];

const sentRows = [
  { beneficiaryId: "a", payloadJson: { surveyId: "s1" } },
  { beneficiaryId: "b", payloadJson: { surveyId: "s2" } },
  { beneficiaryId: "c", payloadJson: { surveyId: null } },
  { beneficiaryId: "d", payloadJson: {} },
];

/** بدون surveyId: أي SURVEY ناجح يستبعد */
{
  const { remaining, alreadySent } = excludePreviouslySentTargets(
    withMobile,
    sentRows,
    null,
  );
  assert.deepEqual(
    remaining.map((x) => x.id),
    [],
  );
  assert.equal(alreadySent, 4);
}

/** مع surveyId=s1: يستبعد فقط من أُرسل لهم s1 */
{
  const { remaining, alreadySent } = excludePreviouslySentTargets(
    withMobile,
    sentRows,
    "s1",
  );
  assert.deepEqual(
    remaining.map((x) => x.id),
    ["b", "c", "d"],
  );
  assert.equal(alreadySent, 1);
}

/** مع surveyId=s2 */
{
  const { remaining, alreadySent } = excludePreviouslySentTargets(
    withMobile,
    sentRows,
    "s2",
  );
  assert.deepEqual(
    remaining.map((x) => x.id),
    ["a", "c", "d"],
  );
  assert.equal(alreadySent, 1);
}

console.log("survey-broadcast-exclude.unit: ok");

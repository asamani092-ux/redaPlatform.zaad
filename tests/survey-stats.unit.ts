/**
 * اختبارات تجميع إحصائيات الاستبيان + تحقق RTL في HTML التصدير.
 */
import assert from "node:assert/strict";
import { computeSurveyStats } from "../src/lib/survey-stats";
import type { SurveyQuestion } from "../src/lib/survey-questions";
import { buildPrintDocument } from "../src/lib/print-html";

console.log("=== survey stats ===");

const scaleQ: SurveyQuestion = {
  id: "q1",
  text: "التقييم",
  type: "scale",
  min: 1,
  max: 5,
};

const choiceQ: SurveyQuestion = {
  id: "q2",
  text: "السبب",
  type: "choice_with_other",
  options: ["مرض", "سفر"],
  allowOther: true,
};

const textQ: SurveyQuestion = {
  id: "q3",
  text: "ملاحظة",
  type: "text",
};

const ratedQ: SurveyQuestion = {
  id: "q4",
  text: "الجوانب",
  type: "rated_options",
  options: ["الجودة", "السرعة"],
};

{
  const stats = computeSurveyStats({
    surveyId: "s1",
    surveyTitle: "رضا",
    questions: [scaleQ],
    responses: [
      {
        id: "r1",
        answersJson: { q1: 5 },
        createdAt: "2026-01-01T00:00:00.000Z",
        beneficiary: { name: "أ", nationalId: "1" },
      },
      {
        id: "r2",
        answersJson: { q1: 5 },
        createdAt: "2026-01-01T00:00:00.000Z",
        beneficiary: { name: "ب", nationalId: "2" },
      },
      {
        id: "r3",
        answersJson: { q1: 3 },
        createdAt: "2026-01-01T00:00:00.000Z",
        beneficiary: { name: "ج", nationalId: "3" },
      },
      {
        id: "r4",
        answersJson: { q1: 99 },
        createdAt: "2026-01-01T00:00:00.000Z",
        beneficiary: { name: "د", nationalId: "4" },
      },
    ],
  });
  assert.equal(stats.totalResponses, 4);
  const q = stats.questions[0]!;
  assert.equal(q.answeredCount, 3);
  const five = q.buckets.find((b) => b.label === "5")!;
  assert.equal(five.count, 2);
  assert.equal(five.percent, 66.7);
  const three = q.buckets.find((b) => b.label === "3")!;
  assert.equal(three.count, 1);
  assert.equal(three.percent, 33.3);
  console.log("OK scale ratios + ignore out-of-range");
}

{
  const stats = computeSurveyStats({
    surveyId: "s1",
    surveyTitle: "رضا",
    questions: [choiceQ],
    responses: [
      {
        id: "r1",
        answersJson: { q2: { choice: "مرض" } },
        createdAt: "2026-01-01T00:00:00.000Z",
        beneficiary: { name: "أ", nationalId: "1" },
      },
      {
        id: "r2",
        answersJson: { q2: { choice: "أخرى", otherText: "ظرف عائلي" } },
        createdAt: "2026-01-01T00:00:00.000Z",
        beneficiary: { name: "ب", nationalId: "2" },
      },
      {
        id: "r3",
        answersJson: { q2: { choice: "__other__", otherText: "  " } },
        createdAt: "2026-01-01T00:00:00.000Z",
        beneficiary: { name: "ج", nationalId: "3" },
      },
    ],
  });
  const q = stats.questions[0]!;
  assert.equal(q.answeredCount, 3);
  assert.equal(q.buckets.find((b) => b.label === "مرض")!.count, 1);
  assert.equal(q.buckets.find((b) => b.label === "أخرى")!.count, 2);
  assert.equal(q.textReplies.length, 1);
  assert.equal(q.textReplies[0]!.text, "ظرف عائلي");
  console.log("OK choice + other text replies");
}

{
  const stats = computeSurveyStats({
    surveyId: "s1",
    surveyTitle: "رضا",
    questions: [textQ],
    responses: [
      {
        id: "r1",
        answersJson: { q3: "  ممتاز  " },
        createdAt: "2026-01-01T00:00:00.000Z",
        beneficiary: { name: "أ", nationalId: "1" },
      },
      {
        id: "r2",
        answersJson: { q3: "   " },
        createdAt: "2026-01-01T00:00:00.000Z",
        beneficiary: { name: "ب", nationalId: "2" },
      },
    ],
  });
  const q = stats.questions[0]!;
  assert.equal(q.answeredCount, 1);
  assert.equal(q.buckets.length, 0);
  assert.equal(q.textReplies[0]!.text, "ممتاز");
  console.log("OK text replies skip empty");
}

{
  const stats = computeSurveyStats({
    surveyId: "s1",
    surveyTitle: "رضا",
    questions: [ratedQ],
    responses: [
      {
        id: "r1",
        answersJson: { q4: { الجودة: 5, السرعة: 4 } },
        createdAt: "2026-01-01T00:00:00.000Z",
        beneficiary: { name: "أ", nationalId: "1" },
      },
      {
        id: "r2",
        answersJson: { q4: { الجودة: 5, السرعة: 2 } },
        createdAt: "2026-01-01T00:00:00.000Z",
        beneficiary: { name: "ب", nationalId: "2" },
      },
    ],
  });
  const q = stats.questions[0]!;
  assert.ok(q.optionStats);
  const quality = q.optionStats!.find((o) => o.option === "الجودة")!;
  assert.equal(quality.answeredCount, 2);
  assert.equal(quality.buckets.find((b) => b.label === "5")!.percent, 100);
  console.log("OK rated_options per-option ratios");
}

{
  const html = buildPrintDocument({
    title: "إحصائيات اختبار",
    subtitle: "تحقق ترميز",
    tiles: [{ label: "الردود", value: 3 }],
    sectionsHtml: "<p>نسبة الإجابة 50%</p>",
  });
  assert.match(html, /lang="ar"/);
  assert.match(html, /dir="rtl"/);
  assert.match(html, /charset=["']?utf-8["']?/i);
  assert.match(html, /إحصائيات اختبار/);
  console.log("OK print HTML rtl + utf-8");
}

console.log("survey stats: ALL PASSED");

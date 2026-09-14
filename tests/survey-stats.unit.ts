/**
 * اختبارات تجميع إحصائيات الاستبيان + أشكال العرض والطباعة.
 */
import assert from "node:assert/strict";
import { computeSurveyStats } from "../src/lib/survey-stats";
import type { SurveyQuestion } from "../src/lib/survey-questions";
import { buildPrintDocument } from "../src/lib/print-html";
import {
  buildStatsReportSectionsHtml,
  parseStatsViews,
  serializeStatsViews,
} from "../src/lib/survey-stats-views";

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
  assert.equal(q.average, 4.33);
  const five = q.buckets.find((b) => b.label === "5")!;
  assert.equal(five.count, 2);
  assert.equal(five.percent, 66.7);
  console.log("OK scale ratios + average");
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
  assert.equal(q.average, null);
  assert.equal(q.buckets.find((b) => b.label === "أخرى")!.count, 2);
  assert.equal(q.textReplies.length, 1);
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
  assert.equal(quality.average, 5);
  const speed = q.optionStats!.find((o) => o.option === "السرعة")!;
  assert.equal(speed.average, 3);
  console.log("OK rated_options averages");
}

{
  const stats = computeSurveyStats({
    surveyId: "s1",
    surveyTitle: "رضا",
    questions: [scaleQ, textQ],
    responses: [
      {
        id: "r1",
        answersJson: { q1: 4, q3: "ملاحظة طويلة" },
        createdAt: "2026-01-01T00:00:00.000Z",
        beneficiary: { name: "أ", nationalId: "1" },
      },
    ],
  });
  const viewsAll = parseStatsViews(null);
  const htmlAll = buildStatsReportSectionsHtml(stats, viewsAll);
  assert.match(htmlAll, /جدول النسب/);
  assert.match(htmlAll, /أشرطة أفقية/);
  assert.match(htmlAll, /<svg[\s\S]*ss-pie/);
  assert.match(htmlAll, /ss-avg-value/);
  assert.match(htmlAll, /شريط مكدّس/);
  assert.match(htmlAll, /ss-legend/);
  assert.match(htmlAll, /ملاحظة طويلة/);

  const viewsLimited = parseStatsViews("table,pie");
  const htmlLimited = buildStatsReportSectionsHtml(stats, viewsLimited);
  assert.match(htmlLimited, /جدول النسب/);
  assert.match(htmlLimited, /<svg[\s\S]*ss-pie/);
  assert.doesNotMatch(htmlLimited, /أشرطة أفقية/);
  assert.doesNotMatch(htmlLimited, /المتوسط<\/h4>/);
  assert.doesNotMatch(htmlLimited, /الردود النصية/);

  const viewsTexts = parseStatsViews("texts");
  const htmlTexts = buildStatsReportSectionsHtml(stats, viewsTexts);
  assert.match(htmlTexts, /الردود النصية/);
  assert.doesNotMatch(htmlTexts, /جدول النسب/);

  assert.equal(serializeStatsViews(viewsLimited), "table,pie");
  console.log("OK print HTML respects views + legend outside pie");
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
  console.log("OK print document rtl + utf-8");
}

console.log("survey stats: ALL PASSED");

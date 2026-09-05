/**
 * اختبارات أنواع أسئلة الاستبيان والتحقق من الإجابات.
 */
import assert from "node:assert/strict";
import {
  SURVEY_TEXT_DEFAULTS,
  asQuestion,
  normalizeSurveyAnswer,
  validateSurveyAnswer,
} from "../src/lib/survey-questions";

console.log("=== survey question types ===");

// asQuestion: scale defaults
{
  const q = asQuestion({ id: "q1", text: "تقييم", type: "scale" });
  assert.ok(q);
  assert.equal(q!.type, "scale");
  assert.equal(q!.min, 1);
  assert.equal(q!.max, 5);
}

// asQuestion: text defaults
{
  const q = asQuestion({ id: "q2", text: "ملاحظة", type: "text" });
  assert.ok(q);
  assert.equal(q!.type, "text");
  assert.equal(q!.maxLength, SURVEY_TEXT_DEFAULTS.maxLength);
  assert.equal(q!.minRows, SURVEY_TEXT_DEFAULTS.minRows);
  assert.equal(q!.maxRows, SURVEY_TEXT_DEFAULTS.maxRows);
  assert.equal(q!.textExpand, true);
}

// asQuestion: rated_options
{
  const q = asQuestion({
    id: "q3",
    text: "قيّم الجوانب",
    type: "rated_options",
    options: ["السرعة", "الجودة", ""],
  });
  assert.ok(q);
  assert.equal(q!.type, "rated_options");
  assert.deepEqual(q!.options, ["السرعة", "الجودة"]);
}

// asQuestion: choice_with_other
{
  const q = asQuestion({
    id: "q4",
    text: "سبب الغياب",
    type: "choice_with_other",
    options: ["مرض", "سفر"],
  });
  assert.ok(q);
  assert.equal(q!.type, "choice_with_other");
  assert.equal(q!.allowOther, true);
  assert.equal(q!.maxLength, SURVEY_TEXT_DEFAULTS.maxLength);
}

// نوع غير معروف → text
{
  const q = asQuestion({ id: "q5", text: "س", type: "unknown" });
  assert.equal(q!.type, "text");
}

// validate rated_options
{
  const q = asQuestion({
    id: "r1",
    text: "تقييم",
    type: "rated_options",
    options: ["أ", "ب"],
  })!;
  assert.ok(validateSurveyAnswer(q, {}));
  assert.ok(validateSurveyAnswer(q, { أ: 3 }));
  assert.equal(validateSurveyAnswer(q, { أ: 4, ب: 5 }), null);
  assert.ok(validateSurveyAnswer(q, { أ: 0, ب: 5 }));
  assert.ok(validateSurveyAnswer(q, { أ: 6, ب: 5 }));
}

// validate choice_with_other
{
  const q = asQuestion({
    id: "c1",
    text: "اختيار",
    type: "choice_with_other",
    options: ["نعم", "لا"],
  })!;
  assert.ok(validateSurveyAnswer(q, { choice: "" }));
  assert.equal(validateSurveyAnswer(q, { choice: "نعم" }), null);
  assert.ok(validateSurveyAnswer(q, { choice: "أخرى" }));
  assert.equal(
    validateSurveyAnswer(q, { choice: "أخرى", otherText: "تفاصيل" }),
    null,
  );
  assert.ok(
    validateSurveyAnswer(q, {
      choice: "أخرى",
      otherText: "x".repeat(SURVEY_TEXT_DEFAULTS.maxLength + 1),
    }),
  );
}

// validate text maxLength
{
  const q = asQuestion({
    id: "t1",
    text: "نص",
    type: "text",
    maxLength: 10,
  })!;
  assert.ok(validateSurveyAnswer(q, ""));
  assert.equal(validateSurveyAnswer(q, "مرحبا"), null);
  assert.ok(validateSurveyAnswer(q, "12345678901"));
}

// normalize answers
{
  const rated = asQuestion({
    id: "r2",
    text: "ت",
    type: "rated_options",
    options: ["س", "ص"],
  })!;
  assert.deepEqual(normalizeSurveyAnswer(rated, { س: 2, ص: 5, زائد: 1 }), {
    س: 2,
    ص: 5,
  });

  const choice = asQuestion({
    id: "c2",
    text: "ت",
    type: "choice_with_other",
    options: ["أ"],
  })!;
  assert.deepEqual(
    normalizeSurveyAnswer(choice, { choice: "__other__", otherText: "سبب" }),
    { choice: "أخرى", otherText: "سبب" },
  );
}

console.log("survey-question-types.unit: ok");

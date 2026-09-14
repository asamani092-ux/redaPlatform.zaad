/**
 * تجميع إحصائيات ردود استبيان واحد: نسب الإجابات + قوائم النصوص.
 * الزمن: O(R × Q × O) — المساحة: O(Q × K).
 */

import type { SurveyQuestion, SurveyQuestionType } from "@/lib/survey-questions";

export type SurveyStatBucket = {
  label: string;
  count: number;
  percent: number;
};

export type SurveyTextReply = {
  responseId: string;
  beneficiaryName: string;
  nationalId: string;
  text: string;
  createdAt: string;
};

export type SurveyOptionStats = {
  option: string;
  answeredCount: number;
  buckets: SurveyStatBucket[];
};

export type SurveyQuestionStats = {
  questionId: string;
  questionText: string;
  questionType: SurveyQuestionType;
  answeredCount: number;
  buckets: SurveyStatBucket[];
  optionStats?: SurveyOptionStats[];
  textReplies: SurveyTextReply[];
};

export type SurveyStatsResult = {
  surveyId: string;
  surveyTitle: string;
  totalResponses: number;
  questions: SurveyQuestionStats[];
};

export type SurveyStatsResponseRow = {
  id: string;
  answersJson: unknown;
  createdAt: Date | string;
  beneficiary: { name: string; nationalId: string };
};

function roundPercent(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((count / total) * 1000) / 10;
}

function bucketsFromCounts(
  labels: string[],
  counts: Map<string, number>,
  answeredCount: number,
): SurveyStatBucket[] {
  return labels.map((label) => {
    const count = counts.get(label) ?? 0;
    return { label, count, percent: roundPercent(count, answeredCount) };
  });
}

function asAnswersMap(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

function createdAtIso(v: Date | string): string {
  return v instanceof Date ? v.toISOString() : String(v);
}

function pushTextReply(
  list: SurveyTextReply[],
  r: SurveyStatsResponseRow,
  text: string,
) {
  list.push({
    responseId: r.id,
    beneficiaryName: r.beneficiary.name,
    nationalId: r.beneficiary.nationalId,
    text,
    createdAt: createdAtIso(r.createdAt),
  });
}

/**
 * يحسب إحصائيات كل سؤال من ردود الاستبيان المحدد.
 */
export function computeSurveyStats(input: {
  surveyId: string;
  surveyTitle: string;
  questions: SurveyQuestion[];
  responses: SurveyStatsResponseRow[];
}): SurveyStatsResult {
  const { surveyId, surveyTitle, questions, responses } = input;
  return {
    surveyId,
    surveyTitle,
    totalResponses: responses.length,
    questions: questions.map((q) => aggregateQuestion(q, responses)),
  };
}

function aggregateQuestion(
  q: SurveyQuestion,
  responses: SurveyStatsResponseRow[],
): SurveyQuestionStats {
  if (q.type === "scale") return aggregateScale(q, responses);
  if (q.type === "choice_with_other") return aggregateChoice(q, responses);
  if (q.type === "rated_options") return aggregateRatedOptions(q, responses);
  return aggregateText(q, responses);
}

function aggregateScale(
  q: SurveyQuestion,
  responses: SurveyStatsResponseRow[],
): SurveyQuestionStats {
  const min = q.min ?? 1;
  const max = q.max ?? 5;
  const labels: string[] = [];
  for (let n = min; n <= max; n++) labels.push(String(n));
  const counts = new Map<string, number>(labels.map((l) => [l, 0]));
  let answeredCount = 0;

  for (const r of responses) {
    const raw = asAnswersMap(r.answersJson)[q.id];
    const n =
      typeof raw === "number"
        ? raw
        : typeof raw === "string" && raw.trim()
          ? Number(raw.trim())
          : NaN;
    if (!Number.isFinite(n) || n < min || n > max) continue;
    const key = String(n);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    answeredCount++;
  }

  return {
    questionId: q.id,
    questionText: q.text,
    questionType: "scale",
    answeredCount,
    buckets: bucketsFromCounts(labels, counts, answeredCount),
    textReplies: [],
  };
}

function aggregateChoice(
  q: SurveyQuestion,
  responses: SurveyStatsResponseRow[],
): SurveyQuestionStats {
  const opts = q.options ?? [];
  const allowOther = q.allowOther !== false;
  const labels = allowOther ? [...opts, "أخرى"] : [...opts];
  const counts = new Map<string, number>(labels.map((l) => [l, 0]));
  const textReplies: SurveyTextReply[] = [];
  let answeredCount = 0;

  for (const r of responses) {
    const raw = asAnswersMap(r.answersJson)[q.id];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const obj = raw as { choice?: unknown; otherText?: unknown };
    const choice = typeof obj.choice === "string" ? obj.choice.trim() : "";
    if (!choice) continue;

    const isOther = choice === "أخرى" || choice === "__other__";
    if (isOther) {
      if (!allowOther) continue;
      counts.set("أخرى", (counts.get("أخرى") ?? 0) + 1);
      answeredCount++;
      const other =
        typeof obj.otherText === "string" ? obj.otherText.trim() : "";
      if (other) pushTextReply(textReplies, r, other);
      continue;
    }

    if (!opts.includes(choice)) continue;
    counts.set(choice, (counts.get(choice) ?? 0) + 1);
    answeredCount++;
  }

  return {
    questionId: q.id,
    questionText: q.text,
    questionType: "choice_with_other",
    answeredCount,
    buckets: bucketsFromCounts(labels, counts, answeredCount),
    textReplies,
  };
}

function aggregateRatedOptions(
  q: SurveyQuestion,
  responses: SurveyStatsResponseRow[],
): SurveyQuestionStats {
  const opts = q.options ?? [];
  const ratingLabels = ["1", "2", "3", "4", "5"];
  const optionStats: SurveyOptionStats[] = opts.map((option) => {
    const counts = new Map<string, number>(ratingLabels.map((l) => [l, 0]));
    let answeredCount = 0;
    for (const r of responses) {
      const raw = asAnswersMap(r.answersJson)[q.id];
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const map = raw as Record<string, unknown>;
      const v = map[option];
      const n =
        typeof v === "number"
          ? v
          : typeof v === "string" && v.trim()
            ? Number(v.trim())
            : NaN;
      if (!Number.isFinite(n) || n < 1 || n > 5) continue;
      const key = String(n);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      answeredCount++;
    }
    return {
      option,
      answeredCount,
      buckets: bucketsFromCounts(ratingLabels, counts, answeredCount),
    };
  });

  const answeredCount = optionStats.reduce(
    (max, o) => Math.max(max, o.answeredCount),
    0,
  );

  return {
    questionId: q.id,
    questionText: q.text,
    questionType: "rated_options",
    answeredCount,
    buckets: [],
    optionStats,
    textReplies: [],
  };
}

function aggregateText(
  q: SurveyQuestion,
  responses: SurveyStatsResponseRow[],
): SurveyQuestionStats {
  const textReplies: SurveyTextReply[] = [];
  for (const r of responses) {
    const raw = asAnswersMap(r.answersJson)[q.id];
    if (typeof raw !== "string") continue;
    const text = raw.trim();
    if (!text) continue;
    pushTextReply(textReplies, r, text);
  }

  return {
    questionId: q.id,
    questionText: q.text,
    questionType: "text",
    answeredCount: textReplies.length,
    buckets: [],
    textReplies,
  };
}

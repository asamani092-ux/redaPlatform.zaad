/**
 * إعداد الاستبيان المخزن في surveyQuestionsJson — يدعم الشكلين:
 * مصفوفة أسئلة قديمة، أو غلاف { questions, externalUrl }.
 * O(n) بعدد الأسئلة.
 */
export type SurveyQuestion = {
  id: string;
  text: string;
  type: "scale" | "text";
  min?: number;
  max?: number;
};

export type SurveyConfig = {
  questions: SurveyQuestion[];
  externalUrl: string | null;
};

function asQuestion(raw: unknown): SurveyQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.text !== "string") return null;
  const type = r.type === "scale" ? "scale" : "text";
  return {
    id: r.id,
    text: r.text,
    type,
    min: typeof r.min === "number" ? r.min : undefined,
    max: typeof r.max === "number" ? r.max : undefined,
  };
}

export function parseSurveyConfig(raw: unknown): SurveyConfig {
  if (Array.isArray(raw)) {
    return {
      questions: raw.map(asQuestion).filter((q): q is SurveyQuestion => !!q),
      externalUrl: null,
    };
  }
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const questions = Array.isArray(r.questions)
      ? r.questions.map(asQuestion).filter((q): q is SurveyQuestion => !!q)
      : [];
    const externalUrl =
      typeof r.externalUrl === "string" && r.externalUrl.trim()
        ? r.externalUrl.trim()
        : null;
    return { questions, externalUrl };
  }
  return { questions: [], externalUrl: null };
}

/**
 * كتالوج الاستبيانات في surveyQuestionsJson.
 * يدعم الشكل القديم (توافقي) والشكل الجديد { version:2, surveys:[...] }.
 * Time: O(n) بعدد الأسئلة/الاستبيانات.
 */

export type SurveyQuestionType =
  | "scale"
  | "text"
  | "rated_options"
  | "choice_with_other";

export type SurveyQuestion = {
  id: string;
  text: string;
  type: SurveyQuestionType;
  min?: number;
  max?: number;
  /** خيارات لـ rated_options و choice_with_other */
  options?: string[];
  /** إظهار خيار «أخرى» — لـ choice_with_other (افتراضي true) */
  allowOther?: boolean;
  /** حد أحرف النص / أخرى — افتراضي 500 */
  maxLength?: number;
  /** توسيع تلقائي لمربع النص */
  textExpand?: boolean;
  /** صفوف البداية — افتراضي 3 */
  minRows?: number;
  /** أقصى صفوف عند التوسيع — افتراضي 8 */
  maxRows?: number;
};

/** أشكال الإجابات حسب النوع */
export type SurveyAnswerValue =
  | string
  | number
  | Record<string, number> // rated_options: { [optionLabel]: 1–5 }
  | { choice: string; otherText?: string }; // choice_with_other

export const SURVEY_TEXT_DEFAULTS = {
  maxLength: 500,
  minRows: 3,
  maxRows: 8,
} as const;

export const SURVEY_QUESTION_TYPE_OPTIONS: Array<{
  id: SurveyQuestionType;
  label: string;
}> = [
  { id: "text", label: "نصي" },
  { id: "scale", label: "تقييم رقمي" },
  { id: "rated_options", label: "خيارات بتقييم نجوم" },
  { id: "choice_with_other", label: "اختيار مع أخرى" },
];

/** فئة المستفيدين للإرسال — يحدد من يستلم رابط الاستبيان */
export type SurveyAudience = "attended_only" | "received" | "invited_absent";

export const SURVEY_AUDIENCE_OPTIONS: Array<{
  id: SurveyAudience;
  label: string;
  hint: string;
}> = [
  {
    id: "attended_only",
    label: "من حضر فقط",
    hint: "سجّل حضوراً ولم يُصرَف له بعد",
  },
  {
    id: "received",
    label: "من حضر واستلم",
    hint: "لديه أمر صرف في المعرض",
  },
  {
    id: "invited_absent",
    label: "دُعي ولم يحضر",
    hint: "مدعو ولم يُسجَّل حضوره — مناسب لأسباب عدم الحضور",
  },
];

export type SurveyDefinition = {
  id: string;
  title: string;
  audience: SurveyAudience;
  questions: SurveyQuestion[];
  externalUrl: string | null;
  /** يُطبَّق فقط عندما audience = received */
  autoSendOnDispense: boolean;
  active: boolean;
};

export type SurveyCatalog = {
  version: 2;
  surveys: SurveyDefinition[];
};

/** توافق خلفي لمسارات تتوقع استبياناً واحداً */
export type SurveyConfig = {
  questions: SurveyQuestion[];
  externalUrl: string | null;
  autoSendOnDispense: boolean;
};

function asStringArray(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const opts = raw
    .map((o) => (typeof o === "string" ? o.trim() : ""))
    .filter(Boolean);
  return opts.length ? opts : undefined;
}

function asPositiveInt(raw: unknown, fallback: number): number {
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0
    ? Math.floor(raw)
    : fallback;
}

function asQuestionType(raw: unknown): SurveyQuestionType {
  if (
    raw === "scale" ||
    raw === "text" ||
    raw === "rated_options" ||
    raw === "choice_with_other"
  ) {
    return raw;
  }
  return "text";
}

/** تحليل سؤال خام مع افتراضات الأنواع الجديدة — O(1) */
export function asQuestion(raw: unknown): SurveyQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.text !== "string") return null;
  const type = asQuestionType(r.type);
  const q: SurveyQuestion = {
    id: r.id,
    text: r.text,
    type,
    min: typeof r.min === "number" ? r.min : undefined,
    max: typeof r.max === "number" ? r.max : undefined,
  };

  if (type === "scale") {
    q.min = typeof r.min === "number" ? r.min : 1;
    q.max = typeof r.max === "number" ? r.max : 5;
  }

  if (type === "rated_options" || type === "choice_with_other") {
    q.options = asStringArray(r.options) ?? [];
  }

  if (type === "choice_with_other") {
    q.allowOther = r.allowOther !== false;
  }

  if (type === "text" || type === "choice_with_other") {
    q.maxLength = asPositiveInt(r.maxLength, SURVEY_TEXT_DEFAULTS.maxLength);
    if (typeof r.textExpand === "boolean") q.textExpand = r.textExpand;
    else if (type === "text") q.textExpand = true;
    q.minRows = asPositiveInt(r.minRows, SURVEY_TEXT_DEFAULTS.minRows);
    q.maxRows = asPositiveInt(r.maxRows, SURVEY_TEXT_DEFAULTS.maxRows);
    if (q.maxRows! < q.minRows!) q.maxRows = q.minRows;
  }

  return q;
}

/**
 * التحقق من إجابة سؤال واحد.
 * يُرجع رسالة خطأ عربية أو null عند الصحة.
 * Time: O(o) لخيارات التقييم؛ Space: O(1).
 */
export function validateSurveyAnswer(
  q: SurveyQuestion,
  raw: unknown,
): string | null {
  if (q.type === "scale") {
    const min = q.min ?? 1;
    const max = q.max ?? 5;
    const n = typeof raw === "number" ? raw : Number(String(raw ?? "").trim());
    if (!Number.isFinite(n) || n < min || n > max) {
      return "يرجى اختيار تقييم رقمي";
    }
    return null;
  }

  if (q.type === "text") {
    const maxLen = q.maxLength ?? SURVEY_TEXT_DEFAULTS.maxLength;
    if (typeof raw !== "string" || !raw.trim()) {
      return "يرجى كتابة إجابة";
    }
    if (raw.length > maxLen) {
      return `تجاوز الحد الأقصى (${maxLen}) حرفاً`;
    }
    return null;
  }

  if (q.type === "rated_options") {
    const opts = q.options ?? [];
    if (!opts.length) return "لا خيارات لهذا السؤال";
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return "يرجى تقييم جميع الخيارات";
    }
    const map = raw as Record<string, unknown>;
    for (const opt of opts) {
      const n = map[opt];
      if (typeof n !== "number" || !Number.isFinite(n) || n < 1 || n > 5) {
        return `يرجى تقييم «${opt}» بنجوم من 1 إلى 5`;
      }
    }
    return null;
  }

  if (q.type === "choice_with_other") {
    const opts = q.options ?? [];
    const allowOther = q.allowOther !== false;
    const maxLen = q.maxLength ?? SURVEY_TEXT_DEFAULTS.maxLength;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return "يرجى اختيار إجابة";
    }
    const obj = raw as { choice?: unknown; otherText?: unknown };
    const choice = typeof obj.choice === "string" ? obj.choice.trim() : "";
    if (!choice) return "يرجى اختيار إجابة";
    const isOther = choice === "أخرى" || choice === "__other__";
    if (isOther) {
      if (!allowOther) return "خيار أخرى غير مسموح";
      const other =
        typeof obj.otherText === "string" ? obj.otherText.trim() : "";
      if (!other) return "يرجى كتابة تفاصيل خيار أخرى";
      if ((obj.otherText as string).length > maxLen) {
        return `تجاوز الحد الأقصى (${maxLen}) حرفاً`;
      }
      return null;
    }
    if (!opts.includes(choice)) return "اختيار غير صالح";
    return null;
  }

  return "نوع سؤال غير مدعوم";
}

/**
 * تطبيع الإجابة للحفظ كـ JSON.
 * Time: O(o) — Space: O(o).
 */
export function normalizeSurveyAnswer(
  q: SurveyQuestion,
  raw: unknown,
): SurveyAnswerValue | null {
  if (validateSurveyAnswer(q, raw)) return null;

  if (q.type === "scale") {
    return typeof raw === "number" ? raw : Number(String(raw).trim());
  }
  if (q.type === "text") {
    return String(raw);
  }
  if (q.type === "rated_options") {
    const map = raw as Record<string, number>;
    const out: Record<string, number> = {};
    for (const opt of q.options ?? []) out[opt] = map[opt]!;
    return out;
  }
  if (q.type === "choice_with_other") {
    const obj = raw as { choice: string; otherText?: string };
    const choice = obj.choice.trim();
    if (choice === "أخرى" || choice === "__other__") {
      return { choice: "أخرى", otherText: String(obj.otherText ?? "") };
    }
    return { choice };
  }
  return null;
}

function asAudience(raw: unknown): SurveyAudience {
  if (raw === "attended_only" || raw === "invited_absent" || raw === "received") {
    return raw;
  }
  if (raw === "attended") return "attended_only";
  return "received";
}

function asSurvey(raw: unknown): SurveyDefinition | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" && r.id.trim() ? r.id : null;
  if (!id) return null;
  const title =
    typeof r.title === "string" && r.title.trim()
      ? r.title.trim()
      : "استبيان";
  const questions = Array.isArray(r.questions)
    ? r.questions.map(asQuestion).filter((q): q is SurveyQuestion => !!q)
    : [];
  const externalUrl =
    typeof r.externalUrl === "string" && r.externalUrl.trim()
      ? r.externalUrl.trim()
      : null;
  return {
    id,
    title,
    audience: asAudience(r.audience),
    questions,
    externalUrl,
    autoSendOnDispense: r.autoSendOnDispense === true,
    active: r.active !== false,
  };
}

function legacyToSurvey(raw: Record<string, unknown>): SurveyDefinition {
  const questions = Array.isArray(raw.questions)
    ? raw.questions.map(asQuestion).filter((q): q is SurveyQuestion => !!q)
    : [];
  const externalUrl =
    typeof raw.externalUrl === "string" && raw.externalUrl.trim()
      ? raw.externalUrl.trim()
      : null;
  return {
    id: "default",
    title: "استبيان الرضا",
    audience: "received",
    questions,
    externalUrl,
    autoSendOnDispense: raw.autoSendOnDispense === true,
    active: true,
  };
}

/** قراءة الكتالوج مع ترحيل الشكل القديم — O(n) */
export function parseSurveyCatalog(raw: unknown): SurveyCatalog {
  if (Array.isArray(raw)) {
    return {
      version: 2,
      surveys: [
        {
          id: "default",
          title: "استبيان الرضا",
          audience: "received",
          questions: raw.map(asQuestion).filter((q): q is SurveyQuestion => !!q),
          externalUrl: null,
          autoSendOnDispense: false,
          active: true,
        },
      ],
    };
  }
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    if (Array.isArray(r.surveys)) {
      const surveys = r.surveys
        .map(asSurvey)
        .filter((s): s is SurveyDefinition => !!s);
      return { version: 2, surveys };
    }
    // غلاف قديم { questions, externalUrl, autoSendOnDispense }
    if (Array.isArray(r.questions) || "externalUrl" in r || "autoSendOnDispense" in r) {
      return { version: 2, surveys: [legacyToSurvey(r)] };
    }
  }
  return { version: 2, surveys: [] };
}

export function serializeSurveyCatalog(catalog: SurveyCatalog): SurveyCatalog {
  return {
    version: 2,
    surveys: catalog.surveys.map((s) => {
      const externalUrl = s.externalUrl?.trim() || null;
      const questions = s.questions.filter((q) => q.text.trim());
      // حصرية: رابط خارجي أو أسئلة داخلية — لا جمع
      const exclusiveQuestions = externalUrl ? [] : questions;
      const exclusiveUrl = exclusiveQuestions.length ? null : externalUrl;
      return {
        ...s,
        title: s.title.trim() || "استبيان",
        questions: exclusiveQuestions,
        externalUrl: exclusiveUrl,
        autoSendOnDispense:
          s.audience === "received" ? s.autoSendOnDispense : false,
      };
    }),
  };
}

export function findSurvey(
  catalog: SurveyCatalog,
  surveyId: string | null | undefined,
): SurveyDefinition | null {
  if (!catalog.surveys.length) return null;
  if (surveyId) {
    return catalog.surveys.find((s) => s.id === surveyId) ?? null;
  }
  return (
    catalog.surveys.find((s) => s.active && s.audience === "received") ??
    catalog.surveys.find((s) => s.active) ??
    catalog.surveys[0] ??
    null
  );
}

/** استبيانات تُرسل تلقائياً بعد الصرف */
export function autoSendSurveysOnDispense(catalog: SurveyCatalog): SurveyDefinition[] {
  return catalog.surveys.filter(
    (s) => s.active && s.audience === "received" && s.autoSendOnDispense,
  );
}

export function audienceLabel(audience: SurveyAudience): string {
  return SURVEY_AUDIENCE_OPTIONS.find((o) => o.id === audience)?.label ?? audience;
}

/** توافق خلفي: يعيد إعداد الاستبيان الافتراضي (received أو الأول) */
export function parseSurveyConfig(raw: unknown): SurveyConfig {
  const catalog = parseSurveyCatalog(raw);
  const s = findSurvey(catalog, null);
  if (!s) {
    return { questions: [], externalUrl: null, autoSendOnDispense: false };
  }
  return {
    questions: s.questions,
    externalUrl: s.externalUrl,
    autoSendOnDispense: s.autoSendOnDispense,
  };
}

export function newSurveyId(): string {
  return `sv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

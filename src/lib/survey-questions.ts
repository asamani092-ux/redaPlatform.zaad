/**
 * كتالوج الاستبيانات في surveyQuestionsJson.
 * يدعم الشكل القديم (توافقي) والشكل الجديد { version:2, surveys:[...] }.
 * Time: O(n) بعدد الأسئلة/الاستبيانات.
 */

export type SurveyQuestion = {
  id: string;
  text: string;
  type: "scale" | "text";
  min?: number;
  max?: number;
};

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
    surveys: catalog.surveys.map((s) => ({
      ...s,
      title: s.title.trim() || "استبيان",
      questions: s.questions.filter((q) => q.text.trim()),
      externalUrl: s.externalUrl?.trim() || null,
      autoSendOnDispense: s.audience === "received" ? s.autoSendOnDispense : false,
    })),
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

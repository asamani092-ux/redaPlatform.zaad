import { createHmac, timingSafeEqual } from "crypto";
import { appOrigin } from "@/lib/app-url";
import type { SurveyDefinition } from "@/lib/survey-questions";

export type SurveyDeliveryMode = "internal" | "external" | "invalid";

export type SurveyTokenPayload = {
  exhibitionId: string;
  surveyId: string;
  beneficiaryId: string;
};

type DeliveryOk = {
  ok: true;
  mode: "internal" | "external";
  url: string;
};

type DeliveryErr = {
  ok: false;
  mode: "invalid";
  error: string;
};

function signingSecret(): string {
  return (
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.SURVEY_LINK_SECRET?.trim() ||
    "dev-survey-link-secret"
  );
}

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromB64url(input: string): Buffer | null {
  try {
    const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
    const normalized = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
    return Buffer.from(normalized, "base64");
  } catch {
    return null;
  }
}

/** وضع التسليم: رابط خارجي أو أسئلة داخلية — لا جمع. O(n) للأسئلة. */
export function resolveSurveyMode(
  survey: Pick<SurveyDefinition, "questions" | "externalUrl" | "active">,
): SurveyDeliveryMode {
  const hasExternal = Boolean(survey.externalUrl?.trim());
  const hasQuestions = survey.questions.some((q) => q.text.trim());
  if (hasExternal && hasQuestions) return "invalid";
  if (hasExternal) return "external";
  if (hasQuestions) return "internal";
  return "invalid";
}

/** تحقق حفظ الاستبيان — O(n). */
export function validateSurveyExclusivity(
  survey: Pick<SurveyDefinition, "questions" | "externalUrl" | "active" | "title">,
): string | null {
  const mode = resolveSurveyMode(survey);
  if (mode === "invalid") {
    const hasExternal = Boolean(survey.externalUrl?.trim());
    const hasQuestions = survey.questions.some((q) => q.text.trim());
    if (hasExternal && hasQuestions) {
      return `«${survey.title}»: لا يمكن الجمع بين الرابط الخارجي والأسئلة الداخلية`;
    }
    if (survey.active) {
      return `«${survey.title}»: أضف أسئلة داخلية أو رابطاً خارجياً`;
    }
  }
  return null;
}

/** فرض الحصرية قبل الحفظ: الخارجي يصفّر الأسئلة والعكس. O(n). */
export function enforceSurveyExclusivity(
  survey: SurveyDefinition,
): SurveyDefinition {
  const hasExternal = Boolean(survey.externalUrl?.trim());
  const hasQuestions = survey.questions.some((q) => q.text.trim());
  if (hasExternal && !hasQuestions) {
    return { ...survey, externalUrl: survey.externalUrl!.trim(), questions: [] };
  }
  if (hasQuestions && !hasExternal) {
    return {
      ...survey,
      externalUrl: null,
      questions: survey.questions.filter((q) => q.text.trim()),
    };
  }
  return survey;
}

/** توقيع رمز نموذج المستفيد — O(1). */
export function signSurveyToken(payload: SurveyTokenPayload): string {
  const body = b64url(
    JSON.stringify({
      e: payload.exhibitionId,
      s: payload.surveyId,
      b: payload.beneficiaryId,
      v: 1,
    }),
  );
  const sig = createHmac("sha256", signingSecret()).update(body).digest();
  return `${body}.${b64url(sig)}`;
}

/** فك وتحقق رمز النموذج — O(1). */
export function verifySurveyToken(token: string): SurveyTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sigPart] = parts;
  if (!body || !sigPart) return null;
  const expected = createHmac("sha256", signingSecret()).update(body).digest();
  const actual = fromB64url(sigPart);
  if (!actual || actual.length !== expected.length) return null;
  if (!timingSafeEqual(actual, expected)) return null;
  const raw = fromB64url(body);
  if (!raw) return null;
  try {
    const json = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
    if (json.v !== 1) return null;
    if (
      typeof json.e !== "string" ||
      typeof json.s !== "string" ||
      typeof json.b !== "string"
    ) {
      return null;
    }
    return {
      exhibitionId: json.e,
      surveyId: json.s,
      beneficiaryId: json.b,
    };
  } catch {
    return null;
  }
}

/** بناء رابط التسليم النهائي للإرسال — O(n). */
export function resolveSurveyDelivery(input: {
  survey: SurveyDefinition;
  exhibitionId: string;
  beneficiaryId: string;
  origin?: string;
}): DeliveryOk | DeliveryErr {
  const mode = resolveSurveyMode(input.survey);
  if (mode === "invalid") {
    return {
      ok: false,
      mode: "invalid",
      error: "الاستبيان يحتاج أسئلة داخلية أو رابطاً خارجياً — دون جمعهما",
    };
  }
  if (!input.survey.active) {
    return { ok: false, mode: "invalid", error: "الاستبيان غير مفعّل" };
  }
  if (mode === "external") {
    return {
      ok: true,
      mode: "external",
      url: input.survey.externalUrl!.trim(),
    };
  }
  const origin = (input.origin || appOrigin()).replace(/\/$/, "");
  const token = signSurveyToken({
    exhibitionId: input.exhibitionId,
    surveyId: input.survey.id,
    beneficiaryId: input.beneficiaryId,
  });
  return {
    ok: true,
    mode: "internal",
    url: `${origin}/s/${token}`,
  };
}

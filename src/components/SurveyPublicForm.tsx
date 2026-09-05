"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  SURVEY_TEXT_DEFAULTS,
  validateSurveyAnswer,
  type SurveyAnswerValue,
  type SurveyQuestion,
} from "@/lib/survey-questions";

export type SurveyPublicFormProps = {
  title: string;
  exhibitionName: string;
  questions: SurveyQuestion[];
  /** معاينة إدارية بدون إرسال */
  preview?: boolean;
  /** رمز الرابط العام — مطلوب عند الإرسال الفعلي */
  token?: string;
  alreadySubmitted?: boolean;
  onSubmitted?: () => void;
};

type AnswersState = Record<string, SurveyAnswerValue>;

/**
 * نموذج الاستبيان العام للمستفيد — يُستخدم في /s/[token] ومعاينة الإدارة.
 * Time: O(n) للأسئلة؛ Space: O(n).
 */
export function SurveyPublicForm({
  title,
  exhibitionName,
  questions,
  preview = false,
  token,
  alreadySubmitted = false,
  onSubmitted,
}: SurveyPublicFormProps) {
  const [answers, setAnswers] = useState<AnswersState>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(alreadySubmitted);

  const ordered = useMemo(
    () => questions.filter((q) => q.text.trim()),
    [questions],
  );

  function setAnswer(id: string, value: SurveyAnswerValue) {
    setAnswers((a) => ({ ...a, [id]: value }));
    setFieldErrors((e) => {
      if (!e[id]) return e;
      const next = { ...e };
      delete next[id];
      return next;
    });
  }

  function validateAll(): boolean {
    const errors: Record<string, string> = {};
    for (const q of ordered) {
      const msg = validateSurveyAnswer(q, answers[q.id]);
      if (msg) errors[q.id] = msg;
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setError("يرجى تصحيح الإجابات المظلّلة");
      return false;
    }
    setError("");
    return true;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (done) return;
    if (!validateAll()) return;
    // معاينة تفاعلية بدون حفظ في قاعدة البيانات
    if (preview) {
      setDone(true);
      onSubmitted?.();
      return;
    }
    if (!token) {
      setError("رابط الاستبيان غير صالح");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/s/${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(String(json.error || "تعذّر إرسال الإجابات"));
      return;
    }
    setDone(true);
    onSubmitted?.();
  }

  if (done) {
    return (
      <div className="survey-public">
        <SurveyPublicBrand title={title} exhibitionName={exhibitionName} />
        <p className="survey-public__thanks">
          {preview
            ? "شكراً — تم الإرسال (معاينة فقط، لم يُحفظ في المنصة)."
            : "شكراً لمشاركتك — تم حفظ إجاباتك."}
        </p>
      </div>
    );
  }

  return (
    <div className={`survey-public${preview ? " survey-public--preview" : ""}`}>
      <SurveyPublicBrand title={title} exhibitionName={exhibitionName} />
      {preview ? (
        <p className="survey-public__badge" role="status">
          معاينة كاملة — يمكنك تجربة الإجابة من الجوال دون حفظ
        </p>
      ) : null}
      <form className="survey-public__form" onSubmit={(e) => void submit(e)}>
        {ordered.map((q, idx) => (
          <fieldset key={q.id} className="survey-public__q">
            <legend className="survey-public__q-label">
              <span className="survey-public__q-num">{idx + 1}</span>
              {q.text}
            </legend>
            <QuestionInput
              question={q}
              value={answers[q.id]}
              onChange={(v) => setAnswer(q.id, v)}
            />
            {fieldErrors[q.id] ? (
              <p className="survey-public__field-error" role="alert">
                {fieldErrors[q.id]}
              </p>
            ) : null}
          </fieldset>
        ))}
        {!ordered.length ? (
          <p className="survey-public__empty">لا أسئلة في هذا الاستبيان.</p>
        ) : null}
        {error ? <p className="survey-public__error">{error}</p> : null}
        <button
          type="submit"
          className="survey-public__submit"
          disabled={busy || !ordered.length}
        >
          {busy ? "جاري الإرسال…" : preview ? "إرسال (معاينة)" : "إرسال الإجابات"}
        </button>
      </form>
    </div>
  );
}

function QuestionInput({
  question: q,
  value,
  onChange,
}: {
  question: SurveyQuestion;
  value: SurveyAnswerValue | undefined;
  onChange: (v: SurveyAnswerValue) => void;
}) {
  if (q.type === "scale") {
    const min = q.min ?? 1;
    const max = q.max ?? 5;
    const scaleValues = Array.from(
      { length: Math.max(0, max - min + 1) },
      (_, i) => min + i,
    );
    const selected = value != null ? String(value) : "";
    return (
      <div className="survey-public__scale" role="group">
        {scaleValues.map((n) => {
          const isSel = selected === String(n);
          return (
            <button
              key={n}
              type="button"
              className={`survey-public__scale-btn${isSel ? " is-selected" : ""}`}
              aria-pressed={isSel}
              onClick={() => onChange(String(n))}
            >
              {n}
            </button>
          );
        })}
      </div>
    );
  }

  if (q.type === "rated_options") {
    const opts = q.options ?? [];
    const map =
      value && typeof value === "object" && !Array.isArray(value) && !("choice" in value)
        ? (value as Record<string, number>)
        : {};
    return (
      <div className="survey-public__rated" role="group">
        {opts.map((opt) => (
          <div key={opt} className="survey-public__option-row">
            <span className="survey-public__option-label">{opt}</span>
            <StarRating
              label={opt}
              value={typeof map[opt] === "number" ? map[opt] : 0}
              onChange={(n) => onChange({ ...map, [opt]: n })}
            />
          </div>
        ))}
        {!opts.length ? (
          <p className="survey-public__empty">لا خيارات لهذا السؤال.</p>
        ) : null}
      </div>
    );
  }

  if (q.type === "choice_with_other") {
    const opts = q.options ?? [];
    const allowOther = q.allowOther !== false;
    const maxLen = q.maxLength ?? SURVEY_TEXT_DEFAULTS.maxLength;
    const minRows = q.minRows ?? SURVEY_TEXT_DEFAULTS.minRows;
    const maxRows = q.maxRows ?? SURVEY_TEXT_DEFAULTS.maxRows;
    const obj =
      value && typeof value === "object" && !Array.isArray(value) && "choice" in value
        ? (value as { choice: string; otherText?: string })
        : { choice: "", otherText: "" };
    const isOther = obj.choice === "أخرى" || obj.choice === "__other__";
    return (
      <div className="survey-public__choices" role="radiogroup">
        {opts.map((opt) => {
          const selected = obj.choice === opt;
          return (
            <button
              key={opt}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`survey-public__choice${selected ? " is-selected" : ""}`}
              onClick={() => onChange({ choice: opt })}
            >
              {opt}
            </button>
          );
        })}
        {allowOther ? (
          <button
            type="button"
            role="radio"
            aria-checked={isOther}
            className={`survey-public__choice${isOther ? " is-selected" : ""}`}
            onClick={() =>
              onChange({ choice: "أخرى", otherText: obj.otherText ?? "" })
            }
          >
            أخرى
          </button>
        ) : null}
        {isOther ? (
          <ExpandableText
            value={obj.otherText ?? ""}
            maxLength={maxLen}
            textExpand={q.textExpand !== false}
            minRows={minRows}
            maxRows={maxRows}
            placeholder="اكتب التفاصيل هنا"
            onChange={(text) => onChange({ choice: "أخرى", otherText: text })}
          />
        ) : null}
      </div>
    );
  }

  // text
  const maxLen = q.maxLength ?? SURVEY_TEXT_DEFAULTS.maxLength;
  const minRows = q.minRows ?? SURVEY_TEXT_DEFAULTS.minRows;
  const maxRows = q.maxRows ?? SURVEY_TEXT_DEFAULTS.maxRows;
  return (
    <ExpandableText
      value={typeof value === "string" ? value : ""}
      maxLength={maxLen}
      textExpand={q.textExpand !== false}
      minRows={minRows}
      maxRows={maxRows}
      placeholder="اكتب إجابتك هنا"
      onChange={(text) => onChange(text)}
    />
  );
}

/**
 * تقييم نجوم تفاعلي 1–5 — يدعم RTL واللمس.
 * Time: O(1) — Space: O(1).
 */
function StarRating({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div
      className="survey-public__stars"
      role="group"
      aria-label={`تقييم ${label}`}
      dir="rtl"
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = value >= n;
        return (
          <button
            key={n}
            type="button"
            className={`survey-public__star${filled ? " is-filled" : ""}`}
            aria-label={`${n} من 5`}
            aria-pressed={filled && value === n}
            onClick={() => onChange(n)}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path
                d="M12 2.8l2.9 5.88 6.5.95-4.7 4.58 1.11 6.47L12 17.77 6.19 20.68l1.11-6.47-4.7-4.58 6.5-.95L12 2.8z"
                fill={filled ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </button>
        );
      })}
    </div>
  );
}

function ExpandableText({
  value,
  maxLength,
  textExpand,
  minRows,
  maxRows,
  placeholder,
  onChange,
}: {
  value: string;
  maxLength: number;
  textExpand: boolean;
  minRows: number;
  maxRows: number;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!textExpand || !ref.current) return;
    const el = ref.current;
    el.style.height = "auto";
    const line = 24;
    const minH = minRows * line;
    const maxH = maxRows * line;
    el.style.height = `${Math.min(maxH, Math.max(minH, el.scrollHeight))}px`;
  }, [value, textExpand, minRows, maxRows]);

  return (
    <div className="survey-public__text-wrap">
      <textarea
        ref={ref}
        className="survey-public__text"
        rows={minRows}
        maxLength={maxLength}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="survey-public__char-count" aria-live="polite">
        {value.length} / {maxLength}
      </span>
    </div>
  );
}

function SurveyPublicBrand({
  title,
  exhibitionName,
}: {
  title: string;
  exhibitionName: string;
}) {
  return (
    <header className="survey-public__brand">
      <div className="survey-public__logos" aria-label="شعارات الجمعية والمعرض">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="survey-public__logo survey-public__logo--assoc"
          src="/zad-presentation/assets/logo-full.png"
          alt="شعار الجمعية"
          width={160}
          height={96}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="survey-public__logo survey-public__logo--poster"
          src="/invite-poster.png"
          alt="شعار المعرض"
          width={160}
          height={96}
        />
      </div>
      <h1 className="survey-public__title">{title}</h1>
      <p className="survey-public__exhibition">{exhibitionName}</p>
    </header>
  );
}

export { SurveyPublicBrand };

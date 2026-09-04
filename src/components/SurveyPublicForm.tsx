"use client";

import { useMemo, useState } from "react";
import type { SurveyQuestion } from "@/lib/survey-questions";

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

/**
 * نموذج الاستبيان العام للمستفيد — يُستخدم في /s/[token] ومعاينة الإدارة.
 * Time: O(n) للأسئلة.
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
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(alreadySubmitted);

  const ordered = useMemo(
    () => questions.filter((q) => q.text.trim()),
    [questions],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (preview || done) return;
    if (!token) {
      setError("رابط الاستبيان غير صالح");
      return;
    }
    for (const q of ordered) {
      if (!String(answers[q.id] ?? "").trim()) {
        setError("يرجى الإجابة على جميع الأسئلة");
        return;
      }
    }
    setBusy(true);
    setError("");
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

  if (done && !preview) {
    return (
      <div className="survey-public">
        <SurveyPublicBrand title={title} exhibitionName={exhibitionName} />
        <p className="survey-public__thanks">شكراً لمشاركتك — تم حفظ إجاباتك.</p>
      </div>
    );
  }

  return (
    <div className={`survey-public${preview ? " survey-public--preview" : ""}`}>
      <SurveyPublicBrand title={title} exhibitionName={exhibitionName} />
      {preview ? (
        <p className="survey-public__badge" role="status">
          معاينة — كما يراها المستفيد
        </p>
      ) : null}
      <form className="survey-public__form" onSubmit={(e) => void submit(e)}>
        {ordered.map((q, idx) => {
          const min = q.min ?? 1;
          const max = q.max ?? 5;
          const scaleValues = Array.from(
            { length: Math.max(0, max - min + 1) },
            (_, i) => min + i,
          );
          return (
            <fieldset key={q.id} className="survey-public__q">
              <legend className="survey-public__q-label">
                <span className="survey-public__q-num">{idx + 1}</span>
                {q.text}
              </legend>
              {q.type === "scale" ? (
                <div className="survey-public__scale" role="group">
                  {scaleValues.map((n) => {
                    const selected = answers[q.id] === String(n);
                    return (
                      <button
                        key={n}
                        type="button"
                        className={`survey-public__scale-btn${selected ? " is-selected" : ""}`}
                        aria-pressed={selected}
                        disabled={preview}
                        onClick={() =>
                          setAnswers((a) => ({ ...a, [q.id]: String(n) }))
                        }
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <textarea
                  className="survey-public__text"
                  rows={3}
                  value={answers[q.id] ?? ""}
                  disabled={preview}
                  placeholder="اكتب إجابتك هنا"
                  onChange={(e) =>
                    setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                  }
                />
              )}
            </fieldset>
          );
        })}
        {!ordered.length ? (
          <p className="survey-public__empty">لا أسئلة في هذا الاستبيان.</p>
        ) : null}
        {error ? <p className="survey-public__error">{error}</p> : null}
        {!preview ? (
          <button
            type="submit"
            className="survey-public__submit"
            disabled={busy || !ordered.length}
          >
            {busy ? "جاري الإرسال…" : "إرسال الإجابات"}
          </button>
        ) : null}
      </form>
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="survey-public__logo"
        src="/zad-presentation/assets/logo-full.png"
        alt="شعار المنصة"
        width={160}
        height={96}
      />
      <h1 className="survey-public__title">{title}</h1>
      <p className="survey-public__exhibition">{exhibitionName}</p>
    </header>
  );
}

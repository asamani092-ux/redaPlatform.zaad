"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/PageHeader";
import { Modal } from "@/components/Modal";
import type { SurveyQuestion } from "@/lib/survey-questions";
import { sanitizeNumericInput, toIntOrNull } from "@/lib/num";

type ResponseRow = {
  id: string;
  answersJson: Record<string, unknown>;
  createdAt: string;
  beneficiary: { name: string; nationalId: string };
};

export default function SurveyPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [externalUrl, setExternalUrl] = useState("");
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [beneficiary, setBeneficiary] = useState<{ id: string; name: string } | null>(null);
  const [search, setSearch] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/survey");
    const json = await res.json();
    if (res.ok) {
      setQuestions(json.questions ?? []);
      setExternalUrl(json.externalUrl ?? "");
      setResponses(json.responses ?? []);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function findBeneficiary() {
    setMsg("");
    const res = await fetch(`/api/lookup?q=${encodeURIComponent(search.trim())}`);
    const json = await res.json();
    if (!res.ok) {
      setBeneficiary(null);
      setMsg(json.error || "المستفيد غير موجود");
      return;
    }
    setBeneficiary({ id: json.beneficiary.id, name: json.beneficiary.name });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!beneficiary) {
      setMsg("ابحث عن المستفيد أولاً");
      return;
    }
    const res = await fetch("/api/survey", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ beneficiaryId: beneficiary.id, answers }),
    });
    const json = await res.json();
    setMsg(res.ok ? "تم حفظ الاستبيان" : json.error);
    if (res.ok) {
      setAnswers({});
      setBeneficiary(null);
      setSearch("");
      load();
    }
  }

  async function sendLink() {
    if (!beneficiary) {
      setMsg("ابحث عن المستفيد أولاً");
      return;
    }
    const res = await fetch("/api/survey", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ beneficiaryId: beneficiary.id, answers: {}, sendLink: true }),
    });
    const json = await res.json();
    setMsg(res.ok ? "تم تسجيل رسالة الاستبيان للإرسال" : json.error);
  }

  async function broadcast(audience: "attended" | "received") {
    const label = audience === "attended" ? "كل الحضور" : "كل من استلم قطعاً";
    if (!window.confirm(`إرسال رابط الاستبيان إلى ${label}؟`)) return;
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/survey/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience }),
    });
    const json = await res.json();
    setBusy(false);
    setMsg(res.ok ? `تم تسجيل ${json.sent} رسالة للإرسال (${label})` : json.error);
  }

  function updateQuestion(idx: number, patch: Partial<SurveyQuestion>) {
    setQuestions((qs) => qs.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  }

  function addQuestion() {
    setQuestions((qs) => [
      ...qs,
      { id: `q${Date.now().toString(36)}`, text: "", type: "text" },
    ]);
  }

  async function saveQuestions() {
    if (busy) return;
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        surveyQuestions: questions.filter((q) => q.text.trim()),
        surveyExternalUrl: externalUrl.trim() || null,
      }),
    });
    const json = await res.json();
    setBusy(false);
    setMsg(res.ok ? "تم حفظ إعداد الاستبيان" : json.error || "فشل الحفظ");
    if (res.ok) load();
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="استبيان الرضا"
        description="تحرير الأسئلة، تسجيل الإجابات، أو إرسال الرابط جماعياً"
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => setPreviewOpen(true)}>
              معاينة الاستبيان
            </button>
            <button
              type="button"
              className="btn-recommend"
              disabled={busy}
              onClick={() => broadcast("attended")}
            >
              إرسال لكل الحضور
            </button>
            <button
              type="button"
              className="btn-recommend"
              disabled={busy}
              onClick={() => broadcast("received")}
            >
              إرسال لمن استلم
            </button>
          </>
        }
      />
      {msg ? <p className="msg">{msg}</p> : null}

      {isAdmin ? (
        <section className="panel">
          <h2 className="panel-title">أسئلة الاستبيان (تحرير — مدير)</h2>
          <div style={{ display: "grid", gap: "0.85rem" }}>
            {questions.map((qq, idx) => (
              <div key={qq.id} className="form-grid form-grid--survey-q">
                <div>
                  <label className="label-field">نص السؤال</label>
                  <input
                    className="input-field"
                    value={qq.text}
                    onChange={(e) => updateQuestion(idx, { text: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label-field">النوع</label>
                  <select
                    className="input-field"
                    value={qq.type}
                    onChange={(e) =>
                      updateQuestion(idx, {
                        type: e.target.value as SurveyQuestion["type"],
                        min: e.target.value === "scale" ? (qq.min ?? 1) : undefined,
                        max: e.target.value === "scale" ? (qq.max ?? 5) : undefined,
                      })
                    }
                  >
                    <option value="text">نصي</option>
                    <option value="scale">تقييم رقمي</option>
                  </select>
                </div>
                {qq.type === "scale" ? (
                  <>
                    <div>
                      <label className="label-field">من</label>
                      <input
                        className="input-field"
                        dir="ltr"
                        inputMode="numeric"
                        value={String(qq.min ?? 1)}
                        onChange={(e) =>
                          updateQuestion(idx, {
                            min: toIntOrNull(sanitizeNumericInput(e.target.value, false)) ?? 1,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="label-field">إلى</label>
                      <input
                        className="input-field"
                        dir="ltr"
                        inputMode="numeric"
                        value={String(qq.max ?? 5)}
                        onChange={(e) =>
                          updateQuestion(idx, {
                            max: toIntOrNull(sanitizeNumericInput(e.target.value, false)) ?? 5,
                          })
                        }
                      />
                    </div>
                  </>
                ) : (
                  <div style={{ gridColumn: "span 2" }} />
                )}
                <div style={{ alignSelf: "end" }}>
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={() => setQuestions((qs) => qs.filter((_, i) => i !== idx))}
                  >
                    إزالة
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="form-grid" style={{ marginTop: "0.85rem" }}>
            <div className="full">
              <label className="label-field">
                رابط نموذج خارجي (قوقل فورم / مايكروسوفت فورم) — يُستخدم في رسائل الواتساب إن ضُبط
              </label>
              <input
                className="input-field"
                dir="ltr"
                placeholder="https://forms.gle/..."
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
              />
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={addQuestion}>
              إضافة سؤال
            </button>
            <button type="button" className="btn-primary" disabled={busy} onClick={saveQuestions}>
              {busy ? "جاري الحفظ…" : "حفظ إعداد الاستبيان"}
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <h2 className="panel-title">إدخال إجابات</h2>
        <div className="toolbar">
          <input
            className="input-field"
            placeholder="هوية / جوال / اسم المستفيد"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (search.trim()) void findBeneficiary();
              }
            }}
          />
          <button
            type="button"
            className="btn-primary"
            onClick={() => search.trim() && findBeneficiary()}
          >
            بحث
          </button>
        </div>
        {beneficiary ? (
          <form onSubmit={submit} style={{ marginTop: "1rem" }}>
            <p className="msg">المستفيد: {beneficiary.name}</p>
            <div className="form-grid">
              {questions.map((qq) => (
                <div key={qq.id} className="full">
                  <label className="label-field">{qq.text}</label>
                  <input
                    className="input-field"
                    type={qq.type === "scale" ? "number" : "text"}
                    min={qq.min}
                    max={qq.max}
                    value={answers[qq.id] ?? ""}
                    onChange={(e) => setAnswers((a) => ({ ...a, [qq.id]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="form-actions">
              <button className="btn-primary" type="submit">
                حفظ الإجابات
              </button>
              <button className="btn-secondary" type="button" onClick={sendLink}>
                إرسال رابط واتساب
              </button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="panel">
        <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <h2 className="panel-title" style={{ margin: 0 }}>
            الردود ({responses.length})
          </h2>
          <button
            type="button"
            className="btn-secondary"
            disabled={!responses.length}
            onClick={() => window.open("/api/survey/print", "_blank", "noopener,noreferrer")}
          >
            طباعة الردود
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>المستفيد</th>
                <th>الإجابات</th>
                <th>التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {responses.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.beneficiary.name}
                    <div dir="ltr" style={{ fontSize: "0.8rem", color: "var(--tmkeen-brand-gray)" }}>
                      {r.beneficiary.nationalId}
                    </div>
                  </td>
                  <td>
                    <AttrAnswers answers={r.answersJson} questions={questions} />
                  </td>
                  <td>{new Date(r.createdAt).toLocaleString("ar-SA")}</td>
                </tr>
              ))}
              {!responses.length ? (
                <tr>
                  <td colSpan={3} className="empty">
                    لا ردود بعد
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <Modal open={previewOpen} title="معاينة الاستبيان" onClose={() => setPreviewOpen(false)}>
        {questions.length ? (
          <div className="form-grid">
            {questions.map((qq) => (
              <div key={qq.id} className="full">
                <label className="label-field">{qq.text}</label>
                {qq.type === "scale" ? (
                  <input
                    className="input-field"
                    type="number"
                    min={qq.min ?? 1}
                    max={qq.max ?? 5}
                    placeholder={`${qq.min ?? 1} - ${qq.max ?? 5}`}
                    readOnly
                  />
                ) : (
                  <input className="input-field" placeholder="إجابة نصية" readOnly />
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="empty">لا أسئلة بعد</p>
        )}
        {externalUrl ? (
          <p className="msg" style={{ marginTop: "0.75rem" }} dir="ltr">
            {externalUrl}
          </p>
        ) : null}
      </Modal>
    </div>
  );
}

function AttrAnswers({
  answers,
  questions,
}: {
  answers: Record<string, unknown>;
  questions: SurveyQuestion[];
}) {
  const textFor = (k: string) => questions.find((q) => q.id === k)?.text ?? k;
  return (
    <div className="attr-chips">
      {Object.entries(answers || {}).map(([k, v]) => (
        <span key={k} className="attr-chip">
          <b>{textFor(k)}</b>
          <span>{String(v)}</span>
        </span>
      ))}
    </div>
  );
}

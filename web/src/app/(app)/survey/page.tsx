"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";

type Question = { id: string; text: string; type: string; min?: number; max?: number };
type ResponseRow = {
  id: string;
  answersJson: Record<string, unknown>;
  createdAt: string;
  beneficiary: { name: string; nationalId: string };
};

export default function SurveyPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [beneficiaryId, setBeneficiaryId] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");

  async function load() {
    const res = await fetch("/api/survey");
    const json = await res.json();
    if (res.ok) {
      setQuestions(json.questions ?? []);
      setResponses(json.responses ?? []);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/survey", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ beneficiaryId, answers }),
    });
    const json = await res.json();
    setMsg(res.ok ? "تم حفظ الاستبيان" : json.error);
    if (res.ok) {
      setAnswers({});
      load();
    }
  }

  async function sendLink() {
    const res = await fetch("/api/survey", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ beneficiaryId, answers: {}, sendLink: true }),
    });
    const json = await res.json();
    setMsg(res.ok ? "تم تسجيل رسالة الاستبيان (stub)" : json.error);
  }

  return (
    <div className="page-stack">
      <PageHeader title="استبيان الرضا" description="تسجيل إجابات المستفيد أو إرسال رابط واتساب لاحقاً" />
      {msg ? <p className="msg">{msg}</p> : null}

      <section className="panel">
        <h2 className="panel-title">إدخال إجابات</h2>
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="full">
              <label className="label-field">معرف المستفيد</label>
              <input
                className="input-field"
                dir="ltr"
                value={beneficiaryId}
                onChange={(e) => setBeneficiaryId(e.target.value)}
                required
              />
            </div>
            {questions.map((q) => (
              <div key={q.id} className="full">
                <label className="label-field">{q.text}</label>
                <input
                  className="input-field"
                  type={q.type === "scale" ? "number" : "text"}
                  min={q.min}
                  max={q.max}
                  value={answers[q.id] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
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
      </section>

      <section className="panel">
        <h2 className="panel-title">الردود</h2>
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
                    <AttrAnswers answers={r.answersJson} />
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
    </div>
  );
}

function AttrAnswers({ answers }: { answers: Record<string, unknown> }) {
  return (
    <div className="attr-chips">
      {Object.entries(answers || {}).map(([k, v]) => (
        <span key={k} className="attr-chip">
          <b>{k}</b>
          <span>{String(v)}</span>
        </span>
      ))}
    </div>
  );
}

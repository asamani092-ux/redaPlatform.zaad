"use client";

import { FormEvent, useEffect, useState } from "react";

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
    <div className="space-y-4">
      <div className="panel">
        <h1 className="text-2xl font-extrabold text-primary mb-3">استبيان الرضا</h1>
        {msg ? <p className="mb-3 font-semibold text-primary">{msg}</p> : null}
        <form onSubmit={submit} className="space-y-3">
          <div>
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
            <div key={q.id}>
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
          <div className="flex gap-2 flex-wrap">
            <button className="btn-primary" type="submit">
              حفظ الإجابات
            </button>
            <button className="btn-secondary" type="button" onClick={sendLink}>
              إرسال رابط واتساب (stub)
            </button>
          </div>
        </form>
      </div>
      <div className="panel">
        <h2 className="font-bold text-primary mb-3">الردود</h2>
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
                    <div dir="ltr" className="text-xs">
                      {r.beneficiary.nationalId}
                    </div>
                  </td>
                  <td>{JSON.stringify(r.answersJson)}</td>
                  <td>{new Date(r.createdAt).toLocaleString("ar-SA")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

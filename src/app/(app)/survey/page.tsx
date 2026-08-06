"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/PageHeader";
import { Modal } from "@/components/Modal";
import type { SurveyQuestion } from "@/lib/survey-questions";
import { sanitizeNumericInput, toIntOrNull } from "@/lib/num";
import { PaginationBar } from "@/components/PaginationBar";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type ResponseRow = {
  id: string;
  answersJson: Record<string, unknown>;
  createdAt: string;
  beneficiary: { name: string; nationalId: string };
};

/**
 * شاشة إدارة الاستبيان: إعداد الأسئلة + متابعة الردود.
 * الإدخال من المستفيد عبر واتساب بعد الصرف — لا إدخال يدوي هنا.
 * Time: O(n) لعرض الأسئلة/الردود؛ Space: O(n).
 */
export default function SurveyPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [externalUrl, setExternalUrl] = useState("");
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [msg, setMsg] = useState("");
  const [msgError, setMsgError] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"responses" | "admin">(isAdmin ? "admin" : "responses");
  const [broadcastTarget, setBroadcastTarget] = useState<"attended" | "received" | null>(null);
  const toast = useToast();

  async function load(p = page) {
    const res = await fetch(`/api/survey?page=${p}&pageSize=${DEFAULT_PAGE_SIZE}`);
    const json = await res.json();
    if (res.ok) {
      setQuestions(json.questions ?? []);
      setExternalUrl(json.externalUrl ?? "");
      setResponses(json.responses ?? []);
      setPage(json.page ?? p);
      setTotalPages(json.totalPages ?? 1);
      setTotal(json.total ?? 0);
    }
  }

  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isAdmin && tab === "admin") setTab("responses");
  }, [isAdmin, tab]);

  async function broadcast(audience: "attended" | "received") {
    const label = audience === "attended" ? "كل الحضور" : "كل من استلم قطعاً";
    setBusy(true);
    setMsg("");
    setMsgError(false);
    const res = await fetch("/api/survey/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience }),
    });
    const json = await res.json();
    setBusy(false);
    const failed = Number(json.failed ?? 0);
    const text = res.ok
      ? `أُرسل إلى ${label}: نجح ${json.sent ?? 0} — فشل ${failed}`
      : json.error || "فشل الإرسال الجماعي";
    setMsg(text);
    setMsgError(!res.ok || failed > 0);
    toast.push({
      title: res.ok ? "إرسال جماعي" : "فشل الإرسال",
      body: text,
      tone: !res.ok || failed > 0 ? "warning" : "success",
    });
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
    toast.push({
      title: res.ok ? "تم حفظ إعداد الاستبيان" : json.error || "فشل الحفظ",
      tone: res.ok ? "success" : "danger",
    });
    if (res.ok) void load();
  }

  const tabItems = [
    { id: "responses", label: "الردود" },
    ...(isAdmin ? [{ id: "admin", label: "إعداد الأسئلة" }] : []),
  ];

  return (
    <div className="page-stack">
      <PageHeader
        title="استبيان الرضا"
        description="يُرسل الرابط تلقائياً عبر واتساب بعد الصرف — هنا إعداد الأسئلة ومتابعة الردود"
        breadcrumb={[{ label: "الرئيسية", href: "/dashboard" }, { label: "الاستبيان" }]}
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => setPreviewOpen(true)}>
              معاينة
            </button>
            <button
              type="button"
              className="btn-recommend"
              disabled={busy}
              onClick={() => setBroadcastTarget("received")}
            >
              إعادة إرسال لمن استلم
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => setBroadcastTarget("attended")}
            >
              إرسال لكل الحضور
            </button>
          </>
        }
      />
      {msg ? <p className={`msg ${msgError ? "msg-error" : ""}`}>{msg}</p> : null}

      <p className="page-header__desc">
        المسار التشغيلي: صرف القطع ← خيار إرسال الاستبيان ← رسالة واتساب للمستفيد ← حفظ الردود هنا إن
        كان الاستبيان داخلياً.
      </p>

      <Tabs
        items={tabItems}
        value={tab}
        onChange={(id) => setTab(id as typeof tab)}
      />

      {isAdmin && tab === "admin" ? (
        <section className="panel">
          <h2 className="panel-title">أسئلة الاستبيان</h2>
          <div className="stack-gap">
            {questions.map((qq, idx) => (
              <div key={qq.id} className="field-cell survey-question-card">
                <div className="form-grid form-grid--survey-q">
                  <div className="full-on-mobile">
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
                  ) : null}
                  <div className="survey-question-card__actions">
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => setQuestions((qs) => qs.filter((_, i) => i !== idx))}
                    >
                      إزالة
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {!questions.length ? (
              <EmptyState
                title="لا أسئلة بعد"
                body="أضف أسئلة داخلية لحفظ الردود في المنصة، أو ضع رابط نموذج خارجي لواتساب فقط."
              />
            ) : null}
          </div>

          <div className="form-grid form-grid--single" style={{ marginTop: "var(--space-4)" }}>
            <div className="full">
              <label className="label-field">
                رابط نموذج خارجي (اختياري) — إن وُجد يُستخدم في رسالة الواتساب بدل الاستبيان الداخلي
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
            <button type="button" className="btn-primary" disabled={busy} onClick={() => void saveQuestions()}>
              {busy ? "جاري الحفظ…" : "حفظ الإعداد"}
            </button>
          </div>
        </section>
      ) : null}

      {tab === "responses" ? (
        <section className="panel">
          <div className="toolbar toolbar--between">
            <h2 className="panel-title" style={{ margin: 0 }}>
              الردود المحفوظة ({total})
            </h2>
            <button
              type="button"
              className="btn-secondary"
              disabled={!total}
              onClick={() => window.open("/api/survey/print", "_blank", "noopener,noreferrer")}
            >
              طباعة الردود
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">المستفيد</th>
                  <th scope="col">الإجابات</th>
                  <th scope="col">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {responses.map((r) => (
                  <tr key={r.id}>
                    <td data-label="المستفيد">
                      {r.beneficiary.name}
                      <div className="meta-ltr">{r.beneficiary.nationalId}</div>
                    </td>
                    <td data-label="الإجابات">
                      <AttrAnswers answers={r.answersJson} questions={questions} />
                    </td>
                    <td data-label="التاريخ">{new Date(r.createdAt).toLocaleString("ar-SA")}</td>
                  </tr>
                ))}
                {!responses.length ? (
                  <tr>
                    <td colSpan={3}>
                      <EmptyState
                        title="لا ردود بعد"
                        body="تظهر هنا ردود الاستبيان الداخلي بعد إرساله للمستفيدين عند الصرف."
                      />
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <PaginationBar
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={DEFAULT_PAGE_SIZE}
            busy={busy}
            onPageChange={(p) => void load(p)}
          />
        </section>
      ) : null}

      <Modal open={previewOpen} title="معاينة الاستبيان" onClose={() => setPreviewOpen(false)}>
        {questions.length ? (
          <div className="form-grid form-grid--single">
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
          <EmptyState title="لا أسئلة بعد" body="أضف أسئلة من تبويب إعداد الأسئلة." />
        )}
        {externalUrl ? (
          <p className="msg" style={{ marginTop: "var(--space-3)" }} dir="ltr">
            {externalUrl}
          </p>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(broadcastTarget)}
        title={broadcastTarget === "received" ? "إعادة إرسال لمن استلم" : "إرسال لكل الحضور"}
        body="سيتم إرسال رابط الاستبيان جماعياً عبر واتساب. هل تريد المتابعة؟"
        confirmLabel="إرسال"
        busy={busy}
        onClose={() => setBroadcastTarget(null)}
        onConfirm={() => {
          const target = broadcastTarget;
          setBroadcastTarget(null);
          if (target) void broadcast(target);
        }}
      />
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

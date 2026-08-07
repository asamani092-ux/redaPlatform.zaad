"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/PageHeader";
import { Modal } from "@/components/Modal";
import {
  SURVEY_AUDIENCE_OPTIONS,
  audienceLabel,
  newSurveyId,
  type SurveyAudience,
  type SurveyDefinition,
  type SurveyQuestion,
} from "@/lib/survey-questions";
import { sanitizeNumericInput, toIntOrNull } from "@/lib/num";
import { PaginationBar } from "@/components/PaginationBar";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Chip } from "@/components/ui/Chip";
import { WhatsAppLogModal } from "@/components/WhatsAppLogModal";

type ResponseRow = {
  id: string;
  surveyId?: string;
  answersJson: Record<string, unknown>;
  createdAt: string;
  beneficiary: { name: string; nationalId: string };
};

/**
 * إدارة استبيانات متعددة بفئات مستفيدين مختلفة + متابعة الردود.
 * Time: O(n) للعرض؛ Space: O(n).
 */
export default function SurveyPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [surveys, setSurveys] = useState<SurveyDefinition[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [msg, setMsg] = useState("");
  const [msgError, setMsgError] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"responses" | "admin">(isAdmin ? "admin" : "responses");
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [waLogOpen, setWaLogOpen] = useState(false);
  const toast = useToast();

  const selected = surveys.find((s) => s.id === selectedId) ?? surveys[0] ?? null;

  async function load(p = page, surveyId?: string | null) {
    const sid = surveyId ?? selectedId;
    const qs = new URLSearchParams({
      page: String(p),
      pageSize: String(DEFAULT_PAGE_SIZE),
    });
    if (sid) qs.set("surveyId", sid);
    const res = await fetch(`/api/survey?${qs}`);
    const json = await res.json();
    if (res.ok) {
      const list = (json.surveys ?? []) as SurveyDefinition[];
      setSurveys(list);
      const nextId = (json.selectedSurveyId as string | null) ?? list[0]?.id ?? null;
      setSelectedId(nextId);
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

  function patchSelected(patch: Partial<SurveyDefinition>) {
    if (!selected) return;
    setSurveys((list) =>
      list.map((s) => (s.id === selected.id ? { ...s, ...patch } : s)),
    );
  }

  function updateQuestion(idx: number, patch: Partial<SurveyQuestion>) {
    if (!selected) return;
    patchSelected({
      questions: selected.questions.map((q, i) => (i === idx ? { ...q, ...patch } : q)),
    });
  }

  function addQuestion() {
    if (!selected) return;
    patchSelected({
      questions: [
        ...selected.questions,
        { id: `q${Date.now().toString(36)}`, text: "", type: "text" },
      ],
    });
  }

  function addSurvey() {
    const created: SurveyDefinition = {
      id: newSurveyId(),
      title: "استبيان جديد",
      audience: "received",
      questions: [],
      externalUrl: null,
      autoSendOnDispense: false,
      active: true,
    };
    setSurveys((list) => [...list, created]);
    setSelectedId(created.id);
    setTab("admin");
  }

  function removeSurvey(id: string) {
    setSurveys((list) => {
      const next = list.filter((s) => s.id !== id);
      if (selectedId === id) setSelectedId(next[0]?.id ?? null);
      return next;
    });
  }

  async function saveSurveys() {
    if (busy) return;
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        surveys: surveys.map((s) => ({
          ...s,
          questions: s.questions.filter((q) => q.text.trim()),
          externalUrl: s.externalUrl?.trim() || null,
          autoSendOnDispense:
            s.audience === "received" ? Boolean(s.autoSendOnDispense) : false,
        })),
      }),
    });
    const json = await res.json();
    setBusy(false);
    setMsg(res.ok ? "تم حفظ الاستبيانات" : json.error || "فشل الحفظ");
    toast.push({
      title: res.ok ? "تم حفظ الاستبيانات" : json.error || "فشل الحفظ",
      tone: res.ok ? "success" : "danger",
    });
    if (res.ok) void load(page, selectedId);
  }

  async function broadcast() {
    if (!selected || busy) return;
    setBusy(true);
    setMsg("");
    setMsgError(false);
    const res = await fetch("/api/survey/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ surveyId: selected.id }),
    });
    const json = await res.json();
    setBusy(false);
    setBroadcastOpen(false);
    const failed = Number(json.failed ?? 0);
    const text = res.ok
      ? `«${selected.title}» → ${json.audienceLabel ?? audienceLabel(selected.audience)}: نجح ${json.sent ?? 0} — فشل ${failed}`
      : json.error || "فشل الإرسال الجماعي";
    setMsg(text);
    setMsgError(!res.ok || failed > 0);
    toast.push({
      title: res.ok ? "إرسال جماعي" : "فشل الإرسال",
      body: text,
      tone: !res.ok || failed > 0 ? "warning" : "success",
    });
  }

  const tabItems = [
    { id: "responses", label: "الردود" },
    ...(isAdmin ? [{ id: "admin", label: "إدارة الاستبيانات" }] : []),
  ];

  return (
    <div className="page-stack">
      <PageHeader
        title="الاستبيانات"
        description="أنشئ أكثر من استبيان حسب المستفيدين: حضر فقط، استلم، أو دُعي ولم يحضر"
        breadcrumb={[{ label: "الرئيسية", href: "/dashboard" }, { label: "الاستبيان" }]}
        actions={
          <>
            <button
              type="button"
              className="btn-secondary"
              disabled={!selected}
              onClick={() => setPreviewOpen(true)}
            >
              معاينة
            </button>
            <button
              type="button"
              className="btn-recommend"
              disabled={busy || !selected}
              onClick={() => setBroadcastOpen(true)}
            >
              إرسال للمستفيدين
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setWaLogOpen(true)}
            >
              حالة واتساب
            </button>
            {isAdmin ? (
              <button type="button" className="btn-primary" onClick={addSurvey}>
                استبيان جديد
              </button>
            ) : null}
          </>
        }
      />
      {msg ? <p className={`msg ${msgError ? "msg-error" : ""}`}>{msg}</p> : null}
      <WhatsAppLogModal
        open={waLogOpen}
        onClose={() => setWaLogOpen(false)}
        channel="survey"
      />

      <div className="toolbar" style={{ marginBottom: "var(--space-3)" }}>
        <label className="label-field" style={{ margin: 0 }}>
          الاستبيان
        </label>
        <select
          className="input-field"
          value={selected?.id ?? ""}
          onChange={(e) => {
            const id = e.target.value;
            setSelectedId(id);
            void load(1, id);
          }}
        >
          {!surveys.length ? <option value="">لا استبيانات</option> : null}
          {surveys.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} — {audienceLabel(s.audience)}
              {!s.active ? " (متوقف)" : ""}
            </option>
          ))}
        </select>
      </div>

      <Tabs items={tabItems} value={tab} onChange={(id) => setTab(id as typeof tab)} />

      {isAdmin && tab === "admin" ? (
        <section className="panel">
          {!selected ? (
            <EmptyState
              title="لا استبيانات بعد"
              body="أنشئ استبياناً لكل فئة مستفيدين: من حضر فقط، من استلم، أو من دُعي ولم يحضر."
              action={
                <button type="button" className="btn-primary" onClick={addSurvey}>
                  استبيان جديد
                </button>
              }
            />
          ) : (
            <div className="stack-gap">
              <div className="form-grid">
                <div>
                  <label className="label-field">عنوان الاستبيان</label>
                  <input
                    className="input-field"
                    value={selected.title}
                    onChange={(e) => patchSelected({ title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label-field">المستفيدون المستهدفون</label>
                  <select
                    className="input-field"
                    value={selected.audience}
                    onChange={(e) =>
                      patchSelected({
                        audience: e.target.value as SurveyAudience,
                        autoSendOnDispense:
                          e.target.value === "received"
                            ? selected.autoSendOnDispense
                            : false,
                      })
                    }
                  >
                    {SURVEY_AUDIENCE_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <p className="page-header__desc" style={{ marginTop: "var(--space-2)" }}>
                    {SURVEY_AUDIENCE_OPTIONS.find((o) => o.id === selected.audience)?.hint}
                  </p>
                </div>
              </div>

              <div className="form-grid form-grid--single">
                <div className="full">
                  <label className="label-field">رابط نموذج خارجي (اختياري)</label>
                  <input
                    className="input-field"
                    dir="ltr"
                    placeholder="https://forms.gle/..."
                    value={selected.externalUrl ?? ""}
                    onChange={(e) =>
                      patchSelected({ externalUrl: e.target.value || null })
                    }
                  />
                </div>
                {selected.audience === "received" ? (
                  <div className="full">
                    <label className="check-field" style={{ marginTop: 0 }}>
                      <input
                        type="checkbox"
                        checked={selected.autoSendOnDispense}
                        onChange={(e) =>
                          patchSelected({ autoSendOnDispense: e.target.checked })
                        }
                      />
                      إرسال تلقائي عبر واتساب عند استلام القطع
                    </label>
                  </div>
                ) : null}
                <div className="full">
                  <label className="check-field" style={{ marginTop: 0 }}>
                    <input
                      type="checkbox"
                      checked={selected.active}
                      onChange={(e) => patchSelected({ active: e.target.checked })}
                    />
                    مفعّل
                  </label>
                </div>
              </div>

              <h3 className="panel-title">الأسئلة</h3>
              <div className="stack-gap">
                {selected.questions.map((qq, idx) => (
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
                                  min:
                                    toIntOrNull(
                                      sanitizeNumericInput(e.target.value, false),
                                    ) ?? 1,
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
                                  max:
                                    toIntOrNull(
                                      sanitizeNumericInput(e.target.value, false),
                                    ) ?? 5,
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
                          onClick={() =>
                            patchSelected({
                              questions: selected.questions.filter((_, i) => i !== idx),
                            })
                          }
                        >
                          إزالة
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {!selected.questions.length ? (
                  <EmptyState
                    title="لا أسئلة بعد"
                    body="أضف أسئلة داخلية أو ضع رابط نموذج خارجي."
                  />
                ) : null}
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={addQuestion}>
                  إضافة سؤال
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => removeSurvey(selected.id)}
                >
                  حذف الاستبيان
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busy}
                  onClick={() => void saveSurveys()}
                >
                  {busy ? "جاري الحفظ…" : "حفظ كل الاستبيانات"}
                </button>
              </div>
            </div>
          )}
        </section>
      ) : null}

      {tab === "responses" ? (
        <section className="panel">
          <div className="toolbar toolbar--between">
            <h2 className="panel-title" style={{ margin: 0 }}>
              ردود {selected?.title ?? "الاستبيان"} ({total})
            </h2>
            <div className="row-actions">
              {selected ? (
                <Chip label={audienceLabel(selected.audience)} tone="brand" />
              ) : null}
              <button
                type="button"
                className="btn-secondary"
                disabled={!total || !selected}
                onClick={() =>
                  window.open(
                    `/api/survey/print?surveyId=${encodeURIComponent(selected?.id ?? "")}`,
                    "_blank",
                    "noopener,noreferrer",
                  )
                }
              >
                طباعة الردود
              </button>
            </div>
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
                      <AttrAnswers
                        answers={r.answersJson}
                        questions={selected?.questions ?? []}
                      />
                    </td>
                    <td data-label="التاريخ">
                      {new Date(r.createdAt).toLocaleString("ar-SA")}
                    </td>
                  </tr>
                ))}
                {!responses.length ? (
                  <tr>
                    <td colSpan={3}>
                      <EmptyState
                        title="لا ردود بعد"
                        body="تظهر هنا ردود الاستبيان المحدد بعد إرساله للمستفيدين."
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
            onPageChange={(p) => void load(p, selectedId)}
          />
        </section>
      ) : null}

      <Modal open={previewOpen} title={selected?.title ?? "معاينة"} onClose={() => setPreviewOpen(false)}>
        {selected?.questions.length ? (
          <div className="form-grid form-grid--single">
            <p className="page-header__desc">
              المستفيدون: {audienceLabel(selected.audience)}
            </p>
            {selected.questions.map((qq) => (
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
          <EmptyState title="لا أسئلة بعد" body="أضف أسئلة من تبويب إدارة الاستبيانات." />
        )}
        {selected?.externalUrl ? (
          <p className="msg" style={{ marginTop: "var(--space-3)" }} dir="ltr">
            {selected.externalUrl}
          </p>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={broadcastOpen}
        title="إرسال الاستبيان للمستفيدين"
        body={
          selected
            ? `سيتم إرسال «${selected.title}» إلى: ${audienceLabel(selected.audience)}. هل تريد المتابعة؟`
            : ""
        }
        confirmLabel="إرسال"
        busy={busy}
        onClose={() => setBroadcastOpen(false)}
        onConfirm={() => void broadcast()}
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

"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/PageHeader";
import {
  SURVEY_AUDIENCE_OPTIONS,
  SURVEY_QUESTION_TYPE_OPTIONS,
  SURVEY_TEXT_DEFAULTS,
  audienceLabel,
  newSurveyId,
  type SurveyAudience,
  type SurveyDefinition,
  type SurveyQuestion,
  type SurveyQuestionType,
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

type TrialBeneficiary = {
  id: string;
  name: string;
  nationalId: string;
  mobile: string | null;
  association?: { id: string; name: string } | null;
  associationOther?: string | null;
  statusLabel?: string;
};

/**
 * إدارة استبيانات متعددة بفئات مستفيدين مختلفة + متابعة الردود.
 * Time: O(n) للعرض؛ Space: O(n).
 */
export default function SurveyPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [surveys, setSurveys] = useState<SurveyDefinition[]>([]);
  const [exhibitionName, setExhibitionName] = useState("المعرض");
  const [exhibitionId, setExhibitionId] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [msg, setMsg] = useState("");
  const [msgError, setMsgError] = useState(false);
  const [trialQuery, setTrialQuery] = useState("");
  const [trialResults, setTrialResults] = useState<TrialBeneficiary[]>([]);
  const [trialSelected, setTrialSelected] = useState<TrialBeneficiary | null>(null);
  const [trialBusy, setTrialBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"responses" | "admin">(isAdmin ? "admin" : "responses");
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastCount, setBroadcastCount] = useState<{
    total: number;
    withMobile: number;
    withoutMobile: number;
    audienceLabel: string;
  } | null>(null);
  const [broadcastCountBusy, setBroadcastCountBusy] = useState(false);
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
      if (json.exhibitionName) setExhibitionName(String(json.exhibitionName));
      if (json.exhibitionId) setExhibitionId(String(json.exhibitionId));
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
      list.map((s) => {
        if (s.id !== selected.id) return s;
        let next: SurveyDefinition = { ...s, ...patch };
        const url = (patch.externalUrl !== undefined ? patch.externalUrl : next.externalUrl)?.trim() || null;
        const questions = patch.questions !== undefined ? patch.questions : next.questions;
        const hasUrl = Boolean(url);
        const hasQuestions = questions.some((q) => q.text.trim());
        if (hasUrl && hasQuestions) {
          // آخر تعديل يفوز: إن مُرّر رابط صُفّرت الأسئلة، وإن مُرّرت أسئلة صُفّر الرابط
          if (patch.externalUrl !== undefined && hasUrl) {
            next = { ...next, externalUrl: url, questions: [] };
          } else if (patch.questions !== undefined) {
            next = { ...next, questions, externalUrl: null };
          }
        } else {
          next = { ...next, externalUrl: url, questions };
        }
        return next;
      }),
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

  async function openBroadcast() {
    if (!selected) return;
    setBroadcastOpen(true);
    setBroadcastCount(null);
    setBroadcastCountBusy(true);
    const res = await fetch(
      `/api/survey/broadcast?surveyId=${encodeURIComponent(selected.id)}`,
    );
    const json = await res.json().catch(() => ({}));
    setBroadcastCountBusy(false);
    if (!res.ok) {
      setBroadcastCount(null);
      toast.push({
        title: "تعذّر حساب المستهدفين",
        body: String(json.error || "حاول مرة أخرى"),
        tone: "danger",
      });
      return;
    }
    setBroadcastCount({
      total: Number(json.total ?? 0),
      withMobile: Number(json.withMobile ?? 0),
      withoutMobile: Number(json.withoutMobile ?? 0),
      audienceLabel: String(json.audienceLabel ?? audienceLabel(selected.audience)),
    });
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


  async function searchTrialBeneficiaries(q: string) {
    setTrialQuery(q);
    if (q.trim().length < 2) {
      setTrialResults([]);
      return;
    }
    const res = await fetch(
      `/api/beneficiaries?q=${encodeURIComponent(q.trim())}&page=1&pageSize=10`,
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setTrialResults([]);
      return;
    }
    const rows = (json.data ?? json.beneficiaries ?? []) as TrialBeneficiary[];
    setTrialResults(rows);
  }

  async function sendTrialSurvey() {
    if (!selected || !trialSelected || trialBusy) return;
    if (!trialSelected.mobile) {
      toast.push({ title: "لا يوجد جوال للمستفيد", tone: "danger" });
      return;
    }
    setTrialBusy(true);
    const res = await fetch("/api/survey", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        beneficiaryId: trialSelected.id,
        surveyId: selected.id,
        answers: {},
        sendLink: true,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setTrialBusy(false);
    if (!res.ok) {
      toast.push({
        title: "فشل إرسال التجربة",
        body: String(json.error || "تعذّر الإرسال"),
        tone: "danger",
      });
      setMsg(String(json.error || "فشل إرسال التجربة"));
      setMsgError(true);
      return;
    }
    toast.push({
      title: "تم إرسال الاستبيان تجريبياً",
      body: `أُرسل إلى ${trialSelected.name}`,
      tone: "success",
    });
    setMsg(`أُرسل الاستبيان تجريبياً إلى ${trialSelected.name}`);
    setMsgError(false);
  }

  function openFullPreview() {
    if (!selected) return;
    window.open(
      `/s/preview/${encodeURIComponent(selected.id)}`,
      "_blank",
      "noopener,noreferrer",
    );
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
              onClick={openFullPreview}
            >
              معاينة كاملة
            </button>
            <button
              type="button"
              className="btn-recommend"
              disabled={busy || !selected}
              onClick={() => void openBroadcast()}
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
                    disabled={selected.questions.some((q) => q.text.trim())}
                    onChange={(e) =>
                      patchSelected({ externalUrl: e.target.value || null })
                    }
                  />
                  {selected.questions.some((q) => q.text.trim()) ? (
                    <p className="page-header__desc">
                      معطّل لأن الاستبيان يحتوي أسئلة داخلية — احذف الأسئلة لاستخدام رابط خارجي.
                    </p>
                  ) : (
                    <p className="page-header__desc">
                      إن وُضع رابط خارجي تُرسله الرسالة مباشرة ولا تُحفظ الردود في المنصة.
                    </p>
                  )}
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
                          onChange={(e) => {
                            const type = e.target.value as SurveyQuestionType;
                            const patch: Partial<SurveyQuestion> = { type };
                            if (type === "scale") {
                              patch.min = qq.min ?? 1;
                              patch.max = qq.max ?? 5;
                              patch.options = undefined;
                            } else if (type === "rated_options") {
                              patch.options = qq.options?.length
                                ? qq.options
                                : ["الخيار 1", "الخيار 2"];
                              patch.min = undefined;
                              patch.max = undefined;
                            } else if (type === "choice_with_other") {
                              patch.options = qq.options?.length
                                ? qq.options
                                : ["نعم", "لا"];
                              patch.allowOther = qq.allowOther !== false;
                              patch.maxLength =
                                qq.maxLength ?? SURVEY_TEXT_DEFAULTS.maxLength;
                              patch.minRows =
                                qq.minRows ?? SURVEY_TEXT_DEFAULTS.minRows;
                              patch.maxRows =
                                qq.maxRows ?? SURVEY_TEXT_DEFAULTS.maxRows;
                              patch.textExpand = qq.textExpand !== false;
                              patch.min = undefined;
                              patch.max = undefined;
                            } else {
                              patch.maxLength =
                                qq.maxLength ?? SURVEY_TEXT_DEFAULTS.maxLength;
                              patch.textExpand = qq.textExpand !== false;
                              patch.minRows =
                                qq.minRows ?? SURVEY_TEXT_DEFAULTS.minRows;
                              patch.maxRows =
                                qq.maxRows ?? SURVEY_TEXT_DEFAULTS.maxRows;
                              patch.min = undefined;
                              patch.max = undefined;
                              patch.options = undefined;
                            }
                            updateQuestion(idx, patch);
                          }}
                        >
                          {SURVEY_QUESTION_TYPE_OPTIONS.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.label}
                            </option>
                          ))}
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
                          className="btn-danger btn-sm"
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
                    {qq.type === "rated_options" ||
                    qq.type === "choice_with_other" ? (
                      <div className="survey-options-editor">
                        <label className="label-field">الخيارات</label>
                        <div className="stack-gap">
                          {(qq.options ?? []).map((opt, oi) => (
                            <div key={`${qq.id}-opt-${oi}`} className="row-actions">
                              <input
                                className="input-field"
                                value={opt}
                                onChange={(e) => {
                                  const options = [...(qq.options ?? [])];
                                  options[oi] = e.target.value;
                                  updateQuestion(idx, { options });
                                }}
                              />
                              <button
                                type="button"
                                className="btn-danger btn-sm"
                                onClick={() =>
                                  updateQuestion(idx, {
                                    options: (qq.options ?? []).filter(
                                      (_, i) => i !== oi,
                                    ),
                                  })
                                }
                              >
                                حذف
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            onClick={() =>
                              updateQuestion(idx, {
                                options: [
                                  ...(qq.options ?? []),
                                  `خيار ${(qq.options?.length ?? 0) + 1}`,
                                ],
                              })
                            }
                          >
                            إضافة خيار
                          </button>
                        </div>
                        {qq.type === "choice_with_other" ? (
                          <label
                            className="check-field"
                            style={{ marginTop: "var(--space-2)" }}
                          >
                            <input
                              type="checkbox"
                              checked={qq.allowOther !== false}
                              onChange={(e) =>
                                updateQuestion(idx, {
                                  allowOther: e.target.checked,
                                })
                              }
                            />
                            السماح بخيار «أخرى»
                          </label>
                        ) : null}
                      </div>
                    ) : null}
                    {qq.type === "text" || qq.type === "choice_with_other" ? (
                      <div
                        className="form-grid form-grid--survey-q"
                        style={{ marginTop: "var(--space-2)" }}
                      >
                        <div>
                          <label className="label-field">الحد الأقصى للأحرف</label>
                          <input
                            className="input-field"
                            dir="ltr"
                            inputMode="numeric"
                            value={String(
                              qq.maxLength ?? SURVEY_TEXT_DEFAULTS.maxLength,
                            )}
                            onChange={(e) =>
                              updateQuestion(idx, {
                                maxLength:
                                  toIntOrNull(
                                    sanitizeNumericInput(e.target.value, false),
                                  ) ?? SURVEY_TEXT_DEFAULTS.maxLength,
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className="label-field">صفوف البداية</label>
                          <input
                            className="input-field"
                            dir="ltr"
                            inputMode="numeric"
                            value={String(
                              qq.minRows ?? SURVEY_TEXT_DEFAULTS.minRows,
                            )}
                            onChange={(e) =>
                              updateQuestion(idx, {
                                minRows:
                                  toIntOrNull(
                                    sanitizeNumericInput(e.target.value, false),
                                  ) ?? SURVEY_TEXT_DEFAULTS.minRows,
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className="label-field">أقصى صفوف</label>
                          <input
                            className="input-field"
                            dir="ltr"
                            inputMode="numeric"
                            value={String(
                              qq.maxRows ?? SURVEY_TEXT_DEFAULTS.maxRows,
                            )}
                            onChange={(e) =>
                              updateQuestion(idx, {
                                maxRows:
                                  toIntOrNull(
                                    sanitizeNumericInput(e.target.value, false),
                                  ) ?? SURVEY_TEXT_DEFAULTS.maxRows,
                              })
                            }
                          />
                        </div>
                        <div className="full-on-mobile">
                          <label
                            className="check-field"
                            style={{ marginTop: "1.6rem" }}
                          >
                            <input
                              type="checkbox"
                              checked={qq.textExpand !== false}
                              onChange={(e) =>
                                updateQuestion(idx, {
                                  textExpand: e.target.checked,
                                })
                              }
                            />
                            توسيع تلقائي لمربع النص
                          </label>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
                {!selected.questions.length ? (
                  <EmptyState
                    title="لا أسئلة بعد"
                    body={
                      selected.externalUrl?.trim()
                        ? "هذا الاستبيان على وضع الرابط الخارجي — احذف الرابط لإضافة أسئلة داخلية."
                        : "أضف أسئلة داخلية أو ضع رابط نموذج خارجي (لا يمكن الجمع)."
                    }
                  />
                ) : null}
              </div>


              <div className="panel" style={{ marginTop: "var(--space-4)" }}>
                <h3 className="panel-title">إرسال تجريبي لمستفيد</h3>
                <p className="page-header__desc">
                  ابحث عن مستفيد من قاعدة البيانات ثم أرسل له رابط الاستبيان عبر واتساب للتجربة.
                </p>
                <div className="form-grid form-grid--single">
                  <div className="full">
                    <label className="label-field">بحث بالاسم أو الهوية أو الجوال</label>
                    <input
                      className="input-field"
                      value={trialQuery}
                      placeholder="اكتب حرفين على الأقل…"
                      onChange={(e) => void searchTrialBeneficiaries(e.target.value)}
                    />
                  </div>
                </div>
                {trialResults.length ? (
                  <ul className="stack-gap" style={{ listStyle: "none", padding: 0, marginTop: "var(--space-3)" }}>
                    {trialResults.map((b) => (
                      <li key={b.id}>
                        <button
                          type="button"
                          className={`btn-secondary${trialSelected?.id === b.id ? " is-active" : ""}`}
                          style={{ width: "100%", justifyContent: "flex-start", textAlign: "right" }}
                          onClick={() => setTrialSelected(b)}
                        >
                          <strong>{b.name}</strong>
                          <span className="meta-ltr" style={{ marginInlineStart: "0.5rem" }}>
                            {b.nationalId} — {b.mobile || "بلا جوال"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {trialSelected ? (
                  <div className="stack-gap" style={{ marginTop: "var(--space-3)" }}>
                    <p className="msg">
                      المستفيد المختار: <strong>{trialSelected.name}</strong>
                      <br />
                      الهوية: <span className="meta-ltr">{trialSelected.nationalId}</span>
                      <br />
                      الجوال: <span className="meta-ltr">{trialSelected.mobile || "—"}</span>
                      <br />
                      الجهة:{" "}
                      {trialSelected.association?.name ||
                        trialSelected.associationOther ||
                        "—"}
                      {trialSelected.statusLabel ? (
                        <>
                          <br />
                          الحالة: {trialSelected.statusLabel}
                        </>
                      ) : null}
                    </p>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={trialBusy || !trialSelected.mobile}
                      onClick={() => void sendTrialSurvey()}
                    >
                      {trialBusy ? "جاري الإرسال…" : "إرسال الاستبيان لهذا المستفيد"}
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={addQuestion}
                  disabled={Boolean(selected.externalUrl?.trim())}
                >
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
                className="btn-secondary btn-sm"
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
          <div className="table-wrap table-wrap--stack">
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


      <ConfirmDialog
        open={broadcastOpen}
        title="إرسال الاستبيان للمستفيدين"
        body={
          selected
            ? broadcastCountBusy
              ? `جاري حساب عدد مستهدفي «${selected.title}»…`
              : broadcastCount
                ? `سيتم إرسال «${selected.title}» إلى فئة «${broadcastCount.audienceLabel}»: ${broadcastCount.withMobile} مستفيداً بجوال` +
                  (broadcastCount.withoutMobile > 0
                    ? ` (و${broadcastCount.withoutMobile} بلا جوال سيُتخطَّون كفشل).`
                    : ".") +
                  (broadcastCount.withMobile === 0
                    ? " لا يوجد من يُرسل له حالياً."
                    : " هل تريد المتابعة؟")
                : `سيتم إرسال «${selected.title}» إلى: ${audienceLabel(selected.audience)}. هل تريد المتابعة؟`
            : ""
        }
        confirmLabel="إرسال"
        busy={busy || broadcastCountBusy}
        onClose={() => {
          setBroadcastOpen(false);
          setBroadcastCount(null);
        }}
        onConfirm={() => {
          if (broadcastCount && broadcastCount.withMobile === 0) {
            setBroadcastOpen(false);
            return;
          }
          void broadcast();
        }}
      />
    </div>
  );
}

function formatAnswerDisplay(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object" && !Array.isArray(v)) {
    const obj = v as Record<string, unknown>;
    if ("choice" in obj) {
      const choice = String(obj.choice ?? "");
      const other = typeof obj.otherText === "string" ? obj.otherText.trim() : "";
      return other ? `${choice}: ${other}` : choice;
    }
    return Object.entries(obj)
      .map(([k, val]) => `${k}: ${String(val)}`)
      .join(" · ");
  }
  return String(v);
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
          <span>{formatAnswerDisplay(v)}</span>
        </span>
      ))}
    </div>
  );
}

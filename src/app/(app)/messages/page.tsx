"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/PageHeader";
import { Modal } from "@/components/Modal";
import { PaginationBar } from "@/components/PaginationBar";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { Tabs } from "@/components/ui/Tabs";
import { FilterBar } from "@/components/ui/FilterBar";
import { DataTable } from "@/components/ui/DataTable";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";
import { chipToneForStatus } from "@/lib/whatsapp-status-ui";

type LogRow = {
  beneficiaryId: string;
  name: string;
  mobile: string;
  nationalId: string;
  mobileValid: boolean;
  hasInvite: boolean;
  hasDispense: boolean;
  inviteStatus: string | null;
  inviteStatusLabel: string;
  inviteError: string | null;
  surveyStatus: string | null;
  surveyStatusLabel: string;
  surveyError: string | null;
};

type Counts = {
  total: number;
  inviteFailed: number;
  surveyFailed: number;
  invalidMobile: number;
};

/**
 * سجل رسائل واتساب — نافذة عائمة بتبويبي الدعوة/الاستبيان.
 * Time: O(n) للتحميل؛ تحديث صف O(1).
 */
export default function MessagesPage() {
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const canEditMobile =
    !!role &&
    (hasPermission(role, "beneficiaries:manage") || hasPermission(role, "invites:manage"));
  const canResendInvite = !!role && hasPermission(role, "invites:manage");
  const canResendSurvey = !!role && hasPermission(role, "survey:manage");

  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<"invite" | "survey">("invite");
  const [q, setQ] = useState("");
  const [problem, setProblem] = useState("all");
  const [inviteStatus, setInviteStatus] = useState("all");
  const [surveyStatus, setSurveyStatus] = useState("all");
  const [rows, setRows] = useState<LogRow[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [exhibitionName, setExhibitionName] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [draftMobile, setDraftMobile] = useState<Record<string, string>>({});
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [surveyConfirm, setSurveyConfirm] = useState<LogRow | null>(null);
  const toast = useToast();

  const load = useCallback(
    async (p = 1) => {
      setBusy(true);
      const qs = new URLSearchParams({
        tab,
        page: String(p),
        pageSize: String(DEFAULT_PAGE_SIZE),
        problem,
        inviteStatus,
        surveyStatus,
      });
      if (q.trim()) qs.set("q", q.trim());
      const res = await fetch(`/api/messages?${qs}`);
      const json = await res.json();
      setBusy(false);
      setLoaded(true);
      if (!res.ok) {
        toast.push({ title: json.error || "فشل التحميل", tone: "danger" });
        return;
      }
      setRows(json.data ?? []);
      setCounts(json.counts ?? null);
      setExhibitionName(json.exhibition?.name ?? "");
      setPage(json.page ?? p);
      setTotalPages(json.totalPages ?? 1);
      setTotal(json.total ?? 0);
      const drafts: Record<string, string> = {};
      for (const r of json.data ?? []) {
        drafts[r.beneficiaryId as string] = r.mobile as string;
      }
      setDraftMobile((prev) => ({ ...prev, ...drafts }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toast مستقر عبر المزود
    [tab, problem, inviteStatus, surveyStatus, q],
  );

  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, problem, inviteStatus, surveyStatus]);

  async function saveMobile(row: LogRow) {
    if (!canEditMobile || rowBusy) return;
    const mobile = (draftMobile[row.beneficiaryId] ?? row.mobile).trim();
    setRowBusy(row.beneficiaryId);
    const res = await fetch("/api/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ beneficiaryId: row.beneficiaryId, mobile }),
    });
    const json = await res.json().catch(() => ({}));
    setRowBusy(null);
    if (!res.ok) {
      toast.push({ title: json.error || "فشل حفظ الجوال", tone: "danger" });
      return;
    }
    toast.push({ title: "تم تحديث الجوال", tone: "success" });
    void load(page);
  }

  async function resend(
    row: LogRow,
    channel: "INVITATION" | "SURVEY",
    forceWithoutDispense = false,
  ) {
    if (rowBusy) return;
    setRowBusy(row.beneficiaryId);
    const res = await fetch("/api/messages/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        beneficiaryId: row.beneficiaryId,
        channel,
        forceWithoutDispense,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setRowBusy(null);

    if (res.status === 409 && json.needsConfirm) {
      setSurveyConfirm(row);
      return;
    }
    if (!res.ok) {
      toast.push({ title: json.error || "فشل إعادة الإرسال", tone: "danger" });
      return;
    }
    const ok = json.status !== "FAILED";
    toast.push({
      title: ok ? "تم الإرسال" : "فشل الإرسال",
      body: json.reason || undefined,
      tone: ok ? "success" : "danger",
    });
    void load(page);
  }

  const problemOptions =
    tab === "invite"
      ? [
          { value: "all", label: "كل الحالات" },
          { value: "invalid_mobile", label: "مشكلة في رقم الجوال" },
          { value: "invite_failed", label: "فشل إرسال الدعوة" },
          { value: "invite_none", label: "لم تُرسل دعوة" },
        ]
      : [
          { value: "all", label: "كل الحالات" },
          { value: "invalid_mobile", label: "مشكلة في رقم الجوال" },
          { value: "survey_failed", label: "فشل إرسال الاستبيان" },
          { value: "survey_none", label: "لم يُرسل استبيان" },
          { value: "no_dispense", label: "لم يستلم قطعاً" },
        ];

  return (
    <div className="page-stack">
      <PageHeader
        title="سجل رسائل واتساب"
        description="متابعة حالة إرسال الدعوات والاستبيانات وإصلاح الأرقام وإعادة المحاولة"
        breadcrumb={[
          { label: "الرئيسية", href: "/dashboard" },
          { label: "سجل واتساب" },
        ]}
        actions={
          <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
            فتح السجل
          </button>
        }
      />

      {!open ? (
        <section className="panel">
          <EmptyState
            title="السجل يُعرض في نافذة عائمة"
            body="اضغط «فتح السجل» لمتابعة حالات الإرسال وإصلاح الأرقام وإعادة الإرسال."
            action={
              <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
                فتح السجل
              </button>
            }
          />
        </section>
      ) : null}

      <Modal
        open={open}
        wide
        title={`سجل واتساب${exhibitionName ? ` — ${exhibitionName}` : ""}`}
        onClose={() => setOpen(false)}
      >
        <div className="stack-gap">
          {counts ? (
            <div className="stat-grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
              <div className="field-cell">
                <div className="label-field">المستهدفون</div>
                <strong>{counts.total}</strong>
              </div>
              <div className="field-cell">
                <div className="label-field">فشل دعوة</div>
                <strong>{counts.inviteFailed}</strong>
              </div>
              <div className="field-cell">
                <div className="label-field">فشل استبيان</div>
                <strong>{counts.surveyFailed}</strong>
              </div>
              <div className="field-cell">
                <div className="label-field">جوال غير صالح</div>
                <strong>{counts.invalidMobile}</strong>
              </div>
            </div>
          ) : null}

          <Tabs
            items={[
              { id: "invite", label: "الدعوات" },
              { id: "survey", label: "الاستبيان" },
            ]}
            value={tab}
            onChange={(id) => {
              setTab(id as "invite" | "survey");
              setProblem("all");
              setPage(1);
            }}
          />

          <FilterBar
            onClear={() => {
              setQ("");
              setProblem("all");
              setInviteStatus("all");
              setSurveyStatus("all");
              void load(1);
            }}
          >
            <input
              className="input-field"
              placeholder="بحث بالاسم / الجوال / الهوية"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void load(1);
              }}
            />
            <select
              className="input-field"
              value={problem}
              onChange={(e) => {
                setProblem(e.target.value);
                setPage(1);
              }}
              aria-label="فلتر المشكلة"
            >
              {problemOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              className="input-field"
              value={inviteStatus}
              onChange={(e) => {
                setInviteStatus(e.target.value);
                setPage(1);
              }}
              aria-label="حالة الدعوة"
            >
              <option value="all">حالة الدعوة: الكل</option>
              <option value="SENT">نجاح</option>
              <option value="FAILED">فشل</option>
              <option value="STUBBED">تجريبي</option>
              <option value="none">لم يُرسل</option>
            </select>
            <select
              className="input-field"
              value={surveyStatus}
              onChange={(e) => {
                setSurveyStatus(e.target.value);
                setPage(1);
              }}
              aria-label="حالة الاستبيان"
            >
              <option value="all">حالة الاستبيان: الكل</option>
              <option value="SENT">نجاح</option>
              <option value="FAILED">فشل</option>
              <option value="STUBBED">تجريبي</option>
              <option value="none">لم يُرسل</option>
            </select>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => void load(1)}>
              تطبيق
            </button>
          </FilterBar>

          <p className="page-header__desc">
            {tab === "invite"
              ? "صحّح رقم الجوال عند الفشل ثم أعد إرسال الدعوة من نفس الصف."
              : "إعادة إرسال الاستبيان لمن استلم قطعاً؛ إن لم يستلم سيُطلب تأكيدك قبل الإرسال."}
          </p>

          <DataTable
            loading={!loaded && busy}
            empty={loaded && !rows.length}
            emptyTitle="لا صفوف مطابقة"
            emptyBody="غيّر الفلاتر أو أرسل دعوات/استبيانات أولاً."
            className="table-wrap--stack"
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">المستفيد</th>
                  <th scope="col">الجوال</th>
                  <th scope="col">حالة الدعوة</th>
                  <th scope="col">حالة الاستبيان</th>
                  <th scope="col">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const inviteTone = chipToneForStatus(r.inviteStatus);
                  const surveyTone = chipToneForStatus(r.surveyStatus);
                  const busyRow = rowBusy === r.beneficiaryId;
                  return (
                    <tr key={r.beneficiaryId}>
                      <td data-label="المستفيد">
                        <strong>{r.name}</strong>
                        <div className="meta-ltr">{r.nationalId}</div>
                        {!r.hasDispense && tab === "survey" ? (
                          <div className="page-header__desc">لم يستلم قطعاً</div>
                        ) : null}
                      </td>
                      <td data-label="الجوال">
                        {canEditMobile ? (
                          <div className="stack-gap" style={{ gap: "var(--space-2)" }}>
                            <input
                              className="input-field"
                              dir="ltr"
                              value={draftMobile[r.beneficiaryId] ?? r.mobile}
                              onChange={(e) =>
                                setDraftMobile((prev) => ({
                                  ...prev,
                                  [r.beneficiaryId]: e.target.value,
                                }))
                              }
                            />
                            {!r.mobileValid ? (
                              <Chip label="رقم غير صالح" tone="danger" />
                            ) : null}
                          </div>
                        ) : (
                          <span className="meta-ltr" dir="ltr">
                            {r.mobile}
                          </span>
                        )}
                      </td>
                      <td data-label="حالة الدعوة">
                        <Chip label={r.inviteStatusLabel} tone={inviteTone} />
                        {r.inviteError ? (
                          <div className="page-header__desc">{r.inviteError}</div>
                        ) : null}
                      </td>
                      <td data-label="حالة الاستبيان">
                        <Chip label={r.surveyStatusLabel} tone={surveyTone} />
                        {r.surveyError ? (
                          <div className="page-header__desc">{r.surveyError}</div>
                        ) : null}
                      </td>
                      <td data-label="إجراءات">
                        <div className="row-actions">
                          {canEditMobile ? (
                            <button
                              type="button"
                              className="btn-secondary"
                              disabled={busyRow}
                              onClick={() => void saveMobile(r)}
                            >
                              حفظ الجوال
                            </button>
                          ) : null}
                          {canResendInvite && (tab === "invite" || r.hasInvite) ? (
                            <button
                              type="button"
                              className="btn-recommend"
                              disabled={busyRow || !r.hasInvite}
                              onClick={() => void resend(r, "INVITATION")}
                            >
                              إعادة الدعوة
                            </button>
                          ) : null}
                          {canResendSurvey && (tab === "survey" || r.surveyStatus || r.hasDispense) ? (
                            <button
                              type="button"
                              className="btn-primary"
                              disabled={busyRow}
                              onClick={() => void resend(r, "SURVEY")}
                            >
                              إعادة الاستبيان
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </DataTable>

          <PaginationBar
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={DEFAULT_PAGE_SIZE}
            busy={busy}
            onPageChange={(p) => {
              setPage(p);
              void load(p);
            }}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(surveyConfirm)}
        title="إرسال استبيان بدون صرف"
        body={
          surveyConfirm
            ? `${surveyConfirm.name} لم يستلم قطعاً بعد. هل تريد إرسال رابط الاستبيان رغم ذلك؟`
            : ""
        }
        confirmLabel="إرسال رغم ذلك"
        busy={Boolean(rowBusy)}
        onClose={() => setSurveyConfirm(null)}
        onConfirm={() => {
          const row = surveyConfirm;
          setSurveyConfirm(null);
          if (row) void resend(row, "SURVEY", true);
        }}
      />
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Modal } from "@/components/Modal";
import { PaginationBar } from "@/components/PaginationBar";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { DataTable } from "@/components/ui/DataTable";
import { Chip } from "@/components/ui/Chip";
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

export type WhatsAppLogChannel = "invite" | "survey";

/**
 * نافذة سجل واتساب ضمن تبويب الدعوة أو الاستبيان.
 * Time: O(n) تحميل؛ Space: O(n).
 */
export function WhatsAppLogModal({
  open,
  onClose,
  channel,
}: {
  open: boolean;
  onClose: () => void;
  channel: WhatsAppLogChannel;
}) {
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const canEditMobile =
    !!role &&
    (hasPermission(role, "beneficiaries:manage") || hasPermission(role, "invites:manage"));
  const canResendInvite = !!role && hasPermission(role, "invites:manage");
  const canResendSurvey = !!role && hasPermission(role, "survey:manage");

  const [q, setQ] = useState("");
  const [problem, setProblem] = useState("all");
  const [status, setStatus] = useState("all");
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
  const [surveyConfirm, setSurveyConfirm] = useState<{
    row: LogRow;
    message: string;
  } | null>(null);
  const toast = useToast();

  const load = useCallback(
    async (p = 1) => {
      setBusy(true);
      const qs = new URLSearchParams({
        tab: channel,
        page: String(p),
        pageSize: String(DEFAULT_PAGE_SIZE),
        problem,
        inviteStatus: channel === "invite" ? status : "all",
        surveyStatus: channel === "survey" ? status : "all",
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [channel, problem, status, q],
  );

  useEffect(() => {
    if (!open) return;
    setProblem("all");
    setStatus("all");
    setQ("");
    setPage(1);
    setLoaded(false);
  }, [open, channel]);

  useEffect(() => {
    if (!open) return;
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, channel, problem, status]);

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
    msgChannel: "INVITATION" | "SURVEY",
    forceWithoutDispense = false,
  ) {
    if (rowBusy) return;
    setRowBusy(row.beneficiaryId);
    const res = await fetch("/api/messages/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        beneficiaryId: row.beneficiaryId,
        channel: msgChannel,
        forceWithoutDispense,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setRowBusy(null);

    if (res.status === 409 && json.needsConfirm) {
      setSurveyConfirm({
        row,
        message:
          typeof json.message === "string"
            ? json.message
            : `${row.name} ليس ضمن مستفيدي هذا الاستبيان. هل تريد الإرسال رغم ذلك؟`,
      });
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
    channel === "invite"
      ? [
          { value: "all", label: "الكل" },
          { value: "invalid_mobile", label: "جوال غير صالح" },
          { value: "invite_failed", label: "فشل الدعوة" },
          { value: "invite_none", label: "لم تُرسل" },
        ]
      : [
          { value: "all", label: "الكل" },
          { value: "invalid_mobile", label: "جوال غير صالح" },
          { value: "survey_failed", label: "فشل الاستبيان" },
          { value: "survey_none", label: "لم يُرسل" },
          { value: "no_dispense", label: "لم يستلم" },
        ];

  const title =
    channel === "invite"
      ? `حالة إرسال الدعوات${exhibitionName ? ` — ${exhibitionName}` : ""}`
      : `حالة إرسال الاستبيان${exhibitionName ? ` — ${exhibitionName}` : ""}`;

  const failedCount =
    channel === "invite" ? counts?.inviteFailed : counts?.surveyFailed;

  return (
    <>
      <Modal open={open} wide title={title} onClose={onClose}>
        <div className="wa-log stack-gap">
          {counts ? (
            <div className="wa-log__summary" aria-live="polite">
              <Chip label={`${counts.total} مستفيد`} tone="neutral" />
              <Chip
                label={`${failedCount ?? 0} فشل`}
                tone={(failedCount ?? 0) > 0 ? "danger" : "success"}
              />
              <Chip
                label={`${counts.invalidMobile} جوال`}
                tone={counts.invalidMobile > 0 ? "warning" : "neutral"}
              />
            </div>
          ) : null}

          <div className="wa-log__filters" role="search">
            <input
              className="input-field"
              placeholder="بحث…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void load(1);
              }}
              aria-label="بحث"
            />
            <select
              className="input-field"
              value={problem}
              onChange={(e) => {
                setProblem(e.target.value);
                setPage(1);
              }}
              aria-label="المشكلة"
            >
              {problemOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              className="input-field"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              aria-label="حالة الإرسال"
            >
              <option value="all">الحالة: الكل</option>
              <option value="SENT">نجاح</option>
              <option value="FAILED">فشل</option>
              <option value="STUBBED">تجريبي</option>
              <option value="none">لم يُرسل</option>
            </select>
            <button
              type="button"
              className="btn-secondary btn-sm"
              disabled={busy}
              onClick={() => void load(1)}
            >
              بحث
            </button>
          </div>

          <DataTable
            loading={!loaded && busy}
            empty={loaded && !rows.length}
            emptyTitle="لا نتائج"
            emptyBody="غيّر الفلتر أو أرسل رسائل أولاً."
            className="table-wrap--stack"
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">المستفيد</th>
                  <th scope="col">الجوال</th>
                  <th scope="col">الحالة</th>
                  <th scope="col">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const statusLabel =
                    channel === "invite" ? r.inviteStatusLabel : r.surveyStatusLabel;
                  const statusTone = chipToneForStatus(
                    channel === "invite" ? r.inviteStatus : r.surveyStatus,
                  );
                  const statusError =
                    channel === "invite" ? r.inviteError : r.surveyError;
                  const busyRow = rowBusy === r.beneficiaryId;
                  return (
                    <tr key={r.beneficiaryId}>
                      <td data-label="المستفيد">
                        <strong>{r.name}</strong>
                        <div className="meta-ltr">{r.nationalId}</div>
                        {channel === "survey" && !r.hasDispense ? (
                          <div className="page-header__desc">لم يستلم قطعاً</div>
                        ) : null}
                      </td>
                      <td data-label="الجوال">
                        {canEditMobile ? (
                          <div className="wa-log__mobile">
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
                              <Chip label="غير صالح" tone="danger" />
                            ) : null}
                          </div>
                        ) : (
                          <span className="meta-ltr" dir="ltr">
                            {r.mobile}
                          </span>
                        )}
                      </td>
                      <td data-label="الحالة">
                        <Chip label={statusLabel} tone={statusTone} />
                        {statusError ? (
                          <div className="page-header__desc">{statusError}</div>
                        ) : null}
                      </td>
                      <td data-label="إجراء">
                        <div className="row-actions">
                          {canEditMobile ? (
                            <button
                              type="button"
                              className="btn-secondary btn-sm"
                              disabled={busyRow}
                              onClick={() => void saveMobile(r)}
                            >
                              حفظ
                            </button>
                          ) : null}
                          {channel === "invite" && canResendInvite ? (
                            <button
                              type="button"
                              className="btn-recommend btn-sm"
                              disabled={busyRow || !r.hasInvite}
                              onClick={() => void resend(r, "INVITATION")}
                            >
                              إعادة إرسال
                            </button>
                          ) : null}
                          {channel === "survey" && canResendSurvey ? (
                            <button
                              type="button"
                              className="btn-primary btn-sm"
                              disabled={busyRow}
                              onClick={() => void resend(r, "SURVEY")}
                            >
                              إعادة إرسال
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
        title="المستفيد خارج الفئة المستهدفة"
        body={surveyConfirm?.message ?? ""}
        confirmLabel="إرسال رغم ذلك"
        busy={Boolean(rowBusy)}
        onClose={() => setSurveyConfirm(null)}
        onConfirm={() => {
          const pending = surveyConfirm;
          setSurveyConfirm(null);
          if (pending) void resend(pending.row, "SURVEY", true);
        }}
      />
    </>
  );
}

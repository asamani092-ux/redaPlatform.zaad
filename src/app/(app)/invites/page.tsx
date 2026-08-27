"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { PaginationBar } from "@/components/PaginationBar";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { Chip } from "@/components/ui/Chip";
import { Tabs } from "@/components/ui/Tabs";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { WhatsAppLogModal } from "@/components/WhatsAppLogModal";

type Row = {
  id: string;
  name: string;
  nationalId: string;
  mobile: string;
  dependentsCount?: number;
  statusLabel?: string;
  qrToken?: string | null;
  inviteDate?: string | null;
  whatsappStatus?: string | null;
  whatsappStatusLabel?: string | null;
  whatsappError?: string | null;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * الدعوات = إنشاء رمز QR + إرساله واتساباً.
 * التصفح: 50 لكل صفحة — O(pageSize).
 */
export default function InvitesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState("");
  const [msgError, setMsgError] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [view, setView] = useState<"pick" | "invited">("pick");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [invitedTotal, setInvitedTotal] = useState(0);
  const [waLogOpen, setWaLogOpen] = useState(false);
  const [uninviteStep, setUninviteStep] = useState<0 | 1 | 2>(0);
  const [inviteDate, setInviteDate] = useState(todayIsoDate);
  const toast = useToast();

  async function loadPick(search = q, p = 1) {
    setBusy(true);
    const res = await fetch(
      `/api/beneficiaries?q=${encodeURIComponent(search)}&page=${p}&pageSize=${DEFAULT_PAGE_SIZE}`,
    );
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return;
    setRows(
      (json.data ?? []).map(
        (r: {
          id: string;
          name: string;
          nationalId: string;
          mobile: string;
          dependentsCount?: number;
          statusLabel?: string;
          qrToken?: string | null;
        }) => ({
          id: r.id,
          name: r.name,
          nationalId: r.nationalId,
          mobile: r.mobile,
          dependentsCount: r.dependentsCount,
          statusLabel: r.statusLabel,
          qrToken: r.qrToken,
        }),
      ),
    );
    setPage(json.page ?? p);
    setTotalPages(json.totalPages ?? 1);
    setTotal(json.total ?? 0);
  }

  async function loadInvited(p = 1) {
    setBusy(true);
    const res = await fetch(`/api/invites?page=${p}&pageSize=${DEFAULT_PAGE_SIZE}`);
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(json.error || "تعذر جلب المدعوين");
      setMsgError(true);
      return;
    }
    setRows(
      (json.data ?? []).map(
        (inv: {
          qrToken: string;
          inviteDate?: string | null;
          whatsappStatus?: string | null;
          whatsappStatusLabel?: string | null;
          whatsappError?: string | null;
          beneficiary: {
            id: string;
            name: string;
            nationalId: string;
            mobile: string;
            dependentsCount?: number;
          };
        }) => ({
          id: inv.beneficiary.id,
          name: inv.beneficiary.name,
          nationalId: inv.beneficiary.nationalId,
          mobile: inv.beneficiary.mobile,
          dependentsCount: inv.beneficiary.dependentsCount,
          statusLabel: "مدعو",
          qrToken: inv.qrToken,
          inviteDate: inv.inviteDate
            ? String(inv.inviteDate).slice(0, 10)
            : null,
          whatsappStatus: inv.whatsappStatus ?? null,
          whatsappStatusLabel: inv.whatsappStatusLabel ?? "لم يُرسل",
          whatsappError: inv.whatsappError ?? null,
        }),
      ),
    );
    setPage(json.page ?? p);
    setTotalPages(json.totalPages ?? 1);
    setTotal(json.total ?? 0);
    setInvitedTotal(json.total ?? 0);
  }

  async function load(p = page) {
    if (view === "invited") return loadInvited(p);
    return loadPick(q, p);
  }

  useEffect(() => {
    void loadPick("", 1);
    fetch(`/api/invites?page=1&pageSize=1`)
      .then((r) => r.json())
      .then((j) => {
        if (typeof j.total === "number") setInvitedTotal(j.total);
      })
      .catch(() => undefined);
    fetch("/api/exhibitions/active")
      .then((r) => r.json())
      .then((j) => {
        const start = j.active?.startsAt ? String(j.active.startsAt).slice(0, 10) : "";
        if (/^\d{4}-\d{2}-\d{2}$/.test(start)) setInviteDate(start);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedIds = Object.entries(selected)
    .filter(([, v]) => v)
    .map(([id]) => id);

  function applySendResult(json: {
    whatsappSent?: number;
    whatsappFailed?: number;
    whatsappStubbed?: number;
    whatsappErrors?: Array<{ beneficiaryName?: string; reason?: string }>;
    status?: string;
    statusReason?: string;
    invited?: number;
    resent?: number;
  }, mode: "invite" | "resend") {
    const failed = Number(json.whatsappFailed ?? 0);
    const stubbed = Number(json.whatsappStubbed ?? 0);
    const sent = Number(json.whatsappSent ?? 0);
    const errors = Array.isArray(json.whatsappErrors) ? json.whatsappErrors : [];
    let waNote = "";
    if (failed > 0) {
      const reasons = errors
        .slice(0, 5)
        .map((e) => `${e.beneficiaryName ?? "مستفيد"}: ${e.reason ?? "فشل"}`)
        .join(" — ");
      waNote = ` — فشل واتساب: ${failed}${reasons ? ` (${reasons})` : ""}`;
      if (json.statusReason && !reasons) waNote += ` — ${json.statusReason}`;
    } else if (stubbed > 0) waNote = ` — واتساب تجريبي (stub): ${stubbed}`;
    else if (sent > 0) waNote = ` — أُرسل واتساب: ${sent}`;
    const head =
      mode === "invite"
        ? `تمت دعوة ${json.invited ?? 0} مستفيد`
        : `أُعيد الإرسال لـ ${json.resent ?? 0} مستفيد`;
    setMsg(`${head}${waNote}`);
    setMsgError(failed > 0 || json.status === "FAILED" || json.status === "PARTIAL");
    toast.push({
      title: head,
      body: waNote.replace(/^ — /, "") || undefined,
      tone: failed > 0 ? "danger" : stubbed > 0 ? "warning" : "success",
    });
  }

  async function inviteAndSend() {
    if (!selectedIds.length) {
      setMsg("حدد مستفيدين أولاً");
      setMsgError(true);
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(inviteDate)) {
      setMsg("حدد تاريخ الحضور للدعوة");
      setMsgError(true);
      return;
    }
    if (busy) return;
    setBusy(true);
    setMsg("");
    setMsgError(false);
    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        beneficiaryIds: selectedIds,
        sendWhatsApp: true,
        inviteDate,
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(json.error || "فشلت الدعوة");
      setMsgError(true);
      return;
    }
    applySendResult(json, "invite");
    setSelected({});
    setView("invited");
    await loadInvited(1);
  }

  /** إلغاء الدعوة — تأكيد ثنائي. Time: O(k). */
  async function uninviteConfirmed() {
    if (!selectedIds.length || busy) return;
    setBusy(true);
    setMsg("");
    setMsgError(false);
    const res = await fetch("/api/invites", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ beneficiaryIds: selectedIds }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    setUninviteStep(0);
    if (!res.ok) {
      setMsg(json.error || "فشل الإلغاء");
      setMsgError(true);
      return;
    }
    setMsg(`أُلغيت دعوة ${json.uninvited ?? 0} مستفيد`);
    setMsgError(false);
    setSelected({});
    await loadInvited(page);
  }

  function startUninvite() {
    if (!selectedIds.length) {
      setMsg("حدد مستفيدين أولاً");
      setMsgError(true);
      return;
    }
    setUninviteStep(1);
  }

  async function resendWhatsApp(ids: string[]) {
    if (!ids.length || busy) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(inviteDate)) {
      setMsg("حدد تاريخ الحضور قبل إعادة الإرسال");
      setMsgError(true);
      return;
    }
    setBusy(true);
    setResendingId(ids.length === 1 ? ids[0] : "bulk");
    setMsg("");
    setMsgError(false);
    const res = await fetch("/api/invites/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ beneficiaryIds: ids, inviteDate }),
    });
    const json = await res.json();
    setBusy(false);
    setResendingId(null);
    if (!res.ok) {
      setMsg(json.error || "فشلت إعادة الإرسال");
      setMsgError(true);
      return;
    }
    applySendResult(json, "resend");
    setSelected({});
    await loadInvited(page);
  }

  function printInvited() {
    if (!invitedTotal) {
      setMsg("لا يوجد مدعوون للطباعة بعد");
      setMsgError(true);
      return;
    }
    window.open("/api/invites/print", "_blank", "noopener,noreferrer");
  }

  async function switchView(next: "pick" | "invited") {
    setView(next);
    setSelected({});
    if (next === "invited") await loadInvited(1);
    else await loadPick(q, 1);
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="الدعوات الجماعية"
        description="دعوة عبر واتساب مع QR — حالة الإرسال ظاهرة لكل مدعو مع إعادة الإرسال"
        breadcrumb={[{ label: "الرئيسية", href: "/dashboard" }, { label: "الدعوات" }]}
        actions={
          <>
            {view === "pick" ? (
              <button
                className="btn-primary"
                type="button"
                disabled={busy || !selectedIds.length}
                title={!selectedIds.length ? "حدد مستفيدين من الجدول أولاً" : undefined}
                onClick={inviteAndSend}
              >
                {busy ? "جاري الإرسال…" : `دعوة وإرسال QR واتساب (${selectedIds.length})`}
              </button>
            ) : (
              <>
                <button
                  className="btn-primary"
                  type="button"
                  disabled={busy || !selectedIds.length}
                  title={!selectedIds.length ? "حدد مدعوين لإعادة الإرسال" : undefined}
                  onClick={() => void resendWhatsApp(selectedIds)}
                >
                  {busy && resendingId === "bulk"
                    ? "جاري إعادة الإرسال…"
                    : `إعادة إرسال واتساب (${selectedIds.length})`}
                </button>
                <button
                  className="btn-danger"
                  type="button"
                  disabled={busy || !selectedIds.length}
                  title={!selectedIds.length ? "حدد مدعوين لإلغاء الدعوة" : undefined}
                  onClick={() => startUninvite()}
                >
                  إلغاء الدعوة ({selectedIds.length})
                </button>
              </>
            )}
            <button
              className="btn-secondary"
              type="button"
              disabled={!invitedTotal}
              title={!invitedTotal ? "لا يوجد مدعوون للطباعة بعد" : undefined}
              onClick={printInvited}
            >
              طباعة قائمة المدعوين ({invitedTotal})
            </button>
            <button
              className="btn-secondary"
              type="button"
              onClick={() => setWaLogOpen(true)}
            >
              حالة واتساب
            </button>
          </>
        }
      />
      {msg ? <p className={`msg ${msgError ? "msg-error" : ""}`}>{msg}</p> : null}
      <WhatsAppLogModal
        open={waLogOpen}
        onClose={() => setWaLogOpen(false)}
        channel="invite"
      />

      <Tabs
        items={[
          { id: "pick", label: "للدعوة" },
          { id: "invited", label: `المدعوون (${invitedTotal})` },
        ]}
        value={view}
        onChange={(id) => void switchView(id as "pick" | "invited")}
      />

      <section className="panel">
        <div className="toolbar">
          <label className="toolbar-label" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span>تاريخ الحضور</span>
            <input
              className="input-field"
              type="date"
              value={inviteDate}
              onChange={(e) => setInviteDate(e.target.value)}
              dir="ltr"
              aria-label="تاريخ الحضور للدعوة"
              title="يُرسل في واتساب كـ {{date}}"
            />
          </label>
          <input
            className="input-field"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="تصفية بالاسم أو الهوية"
            dir="ltr"
            disabled={view === "invited"}
            onKeyDown={(e) => {
              if (e.key === "Enter" && view === "pick") {
                e.preventDefault();
                void loadPick(q, 1);
              }
            }}
          />
          <button
            className="btn-secondary btn-sm"
            type="button"
            onClick={() => void (view === "invited" ? loadInvited(page) : loadPick(q, 1))}
          >
            تحديث
          </button>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">
          {view === "invited" ? "المدعوون" : "للدعوة"} ({total})
        </h2>
        <div className="table-wrap table-wrap--stack">
          <table>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    aria-label="تحديد الكل"
                    checked={rows.length > 0 && rows.every((r) => selected[r.id])}
                    onChange={(e) => {
                      const next: Record<string, boolean> = { ...selected };
                      if (e.target.checked) rows.forEach((r) => (next[r.id] = true));
                      else rows.forEach((r) => delete next[r.id]);
                      setSelected(next);
                    }}
                  />
                </th>
                {view === "invited" ? <th>#</th> : null}
                <th>الاسم</th>
                <th>الهوية</th>
                <th>الجوال</th>
                <th>عدد التابعين</th>
                <th>الحالة</th>
                {view === "invited" ? <th>تاريخ الحضور</th> : null}
                {view === "invited" ? <th>إرسال واتساب</th> : null}
                <th>QR</th>
                {view === "invited" ? <th>إجراءات</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.id}>
                  <td data-label="اختيار">
                    <input
                      type="checkbox"
                      checked={!!selected[r.id]}
                      onChange={(e) =>
                        setSelected((s) => ({ ...s, [r.id]: e.target.checked }))
                      }
                      aria-label={`اختيار ${r.name}`}
                    />
                  </td>
                  {view === "invited" ? (
                    <td data-label="#">{(page - 1) * DEFAULT_PAGE_SIZE + idx + 1}</td>
                  ) : null}
                  <td data-label="الاسم">{r.name}</td>
                  <td data-label="الهوية" dir="ltr">
                    {r.nationalId}
                  </td>
                  <td data-label="الجوال" dir="ltr">
                    {r.mobile}
                  </td>
                  <td data-label="عدد التابعين">{r.dependentsCount ?? 0}</td>
                  <td data-label="الحالة">
                    <span className="badge badge-muted">{r.statusLabel ?? "—"}</span>
                  </td>
                  {view === "invited" ? (
                    <td data-label="تاريخ الحضور" dir="ltr">
                      {r.inviteDate ?? "—"}
                    </td>
                  ) : null}
                  {view === "invited" ? (
                    <td data-label="إرسال واتساب">
                      <Chip
                        label={r.whatsappStatusLabel ?? "لم يُرسل"}
                        tone={
                          r.whatsappStatus === "SENT"
                            ? "success"
                            : r.whatsappStatus === "FAILED"
                              ? "danger"
                              : r.whatsappStatus === "STUBBED"
                                ? "warning"
                                : "neutral"
                        }
                      />
                      {r.whatsappError ? (
                        <div
                          style={{
                            fontSize: "0.78rem",
                            marginTop: "0.25rem",
                            color: "var(--danger-text)",
                            maxWidth: 220,
                          }}
                        >
                          {r.whatsappError}
                        </div>
                      ) : null}
                    </td>
                  ) : null}
                  <td data-label="QR">
                    {r.qrToken ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/qr/${r.qrToken}`} alt={`QR ${r.name}`} width={52} height={52} />
                    ) : (
                      "—"
                    )}
                  </td>
                  {view === "invited" ? (
                    <td data-label="إجراءات">
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          disabled={busy}
                          onClick={() => void resendWhatsApp([r.id])}
                        >
                          {resendingId === r.id ? "جاري…" : "إعادة إرسال"}
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={view === "invited" ? 11 : 8}>
                    <EmptyState
                      title={view === "invited" ? "لا مدعوون بعد" : "لا توجد بيانات"}
                      body={
                        view === "invited"
                          ? "ادعُ مستفيدين من تبويب الاختيار أولاً."
                          : "حدّث البحث أو أضف مستفيدين."
                      }
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

      <ConfirmDialog
        open={uninviteStep === 1}
        title="إلغاء الدعوة"
        body={`هل تريد إلغاء دعوة ${selectedIds.length} مستفيد؟ سيُلغى ظهورهم كمدعوين.`}
        destructive
        confirmLabel="متابعة"
        onClose={() => setUninviteStep(0)}
        onConfirm={() => setUninviteStep(2)}
      />
      <ConfirmDialog
        open={uninviteStep === 2}
        title="تأكيد نهائي"
        body="إلغاء الدعوة للمحددين — السجل يبقى لكن لن يظهروا كمدعوين."
        destructive
        confirmLabel="نعم، ألغِ الدعوة"
        busy={busy}
        onClose={() => setUninviteStep(0)}
        onConfirm={() => void uninviteConfirmed()}
      />
    </div>
  );
}

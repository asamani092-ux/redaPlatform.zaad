"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/PageHeader";
import { Modal } from "@/components/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  EXHIBITION_STATUS_LABELS,
  exhibitionLifecycle,
  type ExhibitionLifecycle,
} from "@/lib/exhibition-status";

type ExhibitionRow = {
  id: string;
  name: string;
  location?: string | null;
  active: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
};

function statusBadgeClass(status: ExhibitionLifecycle): string {
  if (status === "active") return "badge-success";
  if (status === "ended") return "badge-danger";
  if (status === "upcoming" || status === "running") return "badge-warning";
  return "badge-muted";
}

/** قيمة حقل input[type=date] من تاريخ مخزَّن — O(1) */
function dateInputValue(value?: string | null): string {
  return value ? String(value).slice(0, 10) : "";
}

export default function ExhibitionsPage() {
  const [rows, setRows] = useState<ExhibitionRow[]>([]);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [editRow, setEditRow] = useState<ExhibitionRow | null>(null);
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const toast = useToast();

  async function load() {
    const res = await fetch("/api/exhibitions");
    const json = await res.json();
    if (res.ok) setRows(json.data ?? []);
    else setMsg(json.error || "تعذر التحميل");
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/exhibitions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        location: fd.get("location") || null,
        startsAt: fd.get("startsAt") || null,
        endsAt: fd.get("endsAt") || null,
        activate: fd.get("activate") === "on",
      }),
    });
    const json = await res.json();
    setBusy(false);
    setMsg(res.ok ? "تم إنشاء المعرض" : json.error || "فشل الإنشاء");
    toast.push({ title: res.ok ? "تم إنشاء المعرض" : (json.error || "فشل الإنشاء"), tone: res.ok ? "success" : "danger" });
    if (res.ok) {
      setOpen(false);
      e.currentTarget.reset();
      load();
    }
  }

  async function onEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editRow) return;
    setBusy(true);
    setMsg("");
    const fd = new FormData(e.currentTarget);
    const res = await fetch(`/api/exhibitions/${editRow.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        location: fd.get("location") || null,
        startsAt: fd.get("startsAt") || null,
        endsAt: fd.get("endsAt") || null,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? "تم تحديث المعرض" : json.error || "فشل التحديث");
    toast.push({
      title: res.ok ? "تم تحديث المعرض" : json.error || "فشل التحديث",
      tone: res.ok ? "success" : "danger",
    });
    if (res.ok) {
      setEditRow(null);
      load();
    }
  }

  async function activate(id: string) {
    setBusy(true);
    setMsg("");
    const res = await fetch(`/api/exhibitions/${id}/activate`, { method: "PATCH" });
    const json = await res.json();
    setBusy(false);
    setMsg(res.ok ? "تم تفعيل المعرض" : json.error || "فشل التفعيل");
    toast.push({ title: res.ok ? "تم تفعيل المعرض" : (json.error || "فشل التفعيل"), tone: res.ok ? "success" : "danger" });
    if (res.ok) load();
  }

  async function removeExhibition() {
    if (!deleteId || busy) return;
    setBusy(true);
    setMsg("");
    const res = await fetch(`/api/exhibitions/${deleteId}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    setDeleteId(null);
    setDeleteStep(1);
    setMsg(res.ok ? "تم حذف المعرض" : json.error || "فشل الحذف");
    toast.push({
      title: res.ok ? "تم حذف المعرض" : json.error || "فشل الحذف",
      tone: res.ok ? "success" : "danger",
    });
    if (res.ok) load();
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="المعارض"
        description="حالة زمنية (قادم / جاري / منتهٍ) ومعرض تشغيلي واحد نشط"
        breadcrumb={[{ label: "الرئيسية", href: "/dashboard" }, { label: "المعارض" }]}
        actions={
          <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
            إضافة معرض
          </button>
        }
      />
      {msg ? <p className="msg">{msg}</p> : null}

      <section className="panel">
        <div className="table-wrap table-wrap--stack table-wrap--sticky-name">
          <table>
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الموقع</th>
                <th>الفترة</th>
                <th>الحالة</th>
                <th>إجراء</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const status = exhibitionLifecycle({
                  active: r.active,
                  startsAt: r.startsAt,
                  endsAt: r.endsAt,
                });
                const period = [
                  r.startsAt ? String(r.startsAt).slice(0, 10) : "—",
                  r.endsAt ? String(r.endsAt).slice(0, 10) : "—",
                ].join(" ← ");
                return (
                  <tr key={r.id}>
                    <td data-label="الاسم">{r.name}</td>
                    <td data-label="الموقع">{r.location || "—"}</td>
                    <td data-label="الفترة" dir="ltr">
                      {period}
                    </td>
                    <td data-label="الحالة">
                      <span className={`badge ${statusBadgeClass(status)}`}>
                        {EXHIBITION_STATUS_LABELS[status]}
                      </span>
                    </td>
                    <td data-label="إجراء">
                      <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={busy}
                          onClick={() => setEditRow(r)}
                          title="تعديل الاسم والموقع وفترة المعرض"
                        >
                          تعديل
                        </button>
                        {r.active ? null : (
                          <>
                            <button
                              type="button"
                              className="btn-secondary"
                              disabled={busy || status === "ended"}
                              onClick={() => setConfirmId(r.id)}
                              title={status === "ended" ? "المعرض منتهٍ" : "تفعيل تشغيلي"}
                            >
                              تفعيل
                            </button>
                            {isAdmin ? (
                              <button
                                type="button"
                                className="btn-danger"
                                disabled={busy}
                                onClick={() => {
                                  setDeleteStep(1);
                                  setDeleteId(r.id);
                                }}
                              >
                                حذف
                              </button>
                            ) : null}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!rows.length ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState title="لا معارض بعد" body="أضف معرضاً للبدء في التشغيل." />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <Modal open={open} title="إضافة معرض" onClose={() => setOpen(false)}>
        <form onSubmit={onCreate}>
          <div className="form-grid">
            <div className="full">
              <label className="label-field">الاسم (فريد)</label>
              <input name="name" className="input-field" required minLength={2} />
            </div>
            <div className="full">
              <label className="label-field">الموقع</label>
              <input name="location" className="input-field" />
            </div>
            <div>
              <label className="label-field">تاريخ البداية</label>
              <input name="startsAt" type="date" className="input-field" dir="ltr" />
            </div>
            <div>
              <label className="label-field">تاريخ النهاية</label>
              <input name="endsAt" type="date" className="input-field" dir="ltr" />
            </div>
            <div className="full" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input id="activate" name="activate" type="checkbox" />
              <label htmlFor="activate">تفعيله كمعرض نشط الآن</label>
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? "جاري الحفظ..." : "حفظ"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(editRow)}
        title="تعديل المعرض"
        onClose={() => setEditRow(null)}
      >
        {editRow ? (
          <form onSubmit={onEdit} key={editRow.id}>
            <div className="form-grid">
              <div className="full">
                <label className="label-field">الاسم (فريد)</label>
                <input
                  name="name"
                  className="input-field"
                  required
                  minLength={2}
                  defaultValue={editRow.name}
                />
              </div>
              <div className="full">
                <label className="label-field">الموقع</label>
                <input
                  name="location"
                  className="input-field"
                  defaultValue={editRow.location ?? ""}
                />
              </div>
              <div>
                <label className="label-field">تاريخ البداية</label>
                <input
                  name="startsAt"
                  type="date"
                  className="input-field"
                  dir="ltr"
                  defaultValue={dateInputValue(editRow.startsAt)}
                />
              </div>
              <div>
                <label className="label-field">تاريخ النهاية</label>
                <input
                  name="endsAt"
                  type="date"
                  className="input-field"
                  dir="ltr"
                  defaultValue={dateInputValue(editRow.endsAt)}
                />
              </div>
              <p className="full page-header__desc">
                فترة المعرض تحدد أيامه في التقارير اليومية — لا تسبق النهاية البداية.
              </p>
            </div>
            <div className="form-actions">
              <button className="btn-primary" type="submit" disabled={busy}>
                {busy ? "جاري الحفظ..." : "حفظ التعديل"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setEditRow(null)}
              >
                إلغاء
              </button>
            </div>
          </form>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmId)}
        title="تفعيل المعرض"
        body="سيصبح هذا المعرض هو النشط تشغيلياً. هل تريد المتابعة؟"
        confirmLabel="تفعيل"
        busy={busy}
        onClose={() => setConfirmId(null)}
        onConfirm={() => {
          const id = confirmId;
          setConfirmId(null);
          if (id) void activate(id);
        }}
      />

      <ConfirmDialog
        open={!!deleteId && deleteStep === 1}
        title="حذف المعرض"
        body="سيُحذف المعرض وجميع بياناته (مخزون، حضور، صرف…). هل تريد المتابعة؟"
        destructive
        confirmLabel="متابعة"
        onClose={() => {
          setDeleteId(null);
          setDeleteStep(1);
        }}
        onConfirm={() => setDeleteStep(2)}
      />
      <ConfirmDialog
        open={!!deleteId && deleteStep === 2}
        title="تأكيد نهائي"
        body="لا يمكن التراجع عن حذف المعرض."
        destructive
        confirmLabel="نعم، احذف"
        busy={busy}
        onClose={() => {
          setDeleteId(null);
          setDeleteStep(1);
        }}
        onConfirm={() => void removeExhibition()}
      />
    </div>
  );
}

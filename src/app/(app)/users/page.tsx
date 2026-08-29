"use client";

import { FormEvent, useEffect, useState } from "react";
import { ROLE_LABELS } from "@/lib/rbac";
import { PageHeader } from "@/components/PageHeader";
import { Modal } from "@/components/Modal";
import { PaginationBar } from "@/components/PaginationBar";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { AvatarGroup } from "@/components/ui/AvatarGroup";
import { EmptyState } from "@/components/ui/EmptyState";
import { PasswordField } from "@/components/PasswordField";

type UserRow = {
  id: string;
  name: string;
  mobile: string;
  role: keyof typeof ROLE_LABELS;
  active: boolean;
};

type ResetRequestRow = {
  id: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  expiresInSec: number;
  user: { id: string; name: string; mobile: string; role: string };
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [passwordFor, setPasswordFor] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetRequests, setResetRequests] = useState<ResetRequestRow[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  async function load(p = page) {
    const res = await fetch(`/api/users?page=${p}&pageSize=${DEFAULT_PAGE_SIZE}`);
    const json = await res.json();
    if (res.ok) {
      setUsers(json.data ?? []);
      setPage(json.page ?? p);
      setTotalPages(json.totalPages ?? 1);
      setTotal(json.total ?? 0);
    }
  }

  async function loadResetRequests() {
    const res = await fetch("/api/password/requests");
    const json = await res.json().catch(() => ({}));
    if (res.ok) setResetRequests(json.data ?? []);
  }

  useEffect(() => {
    void load(1);
    void loadResetRequests();
    const t = window.setInterval(() => void loadResetRequests(), 5000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function approveReset(requestId: string) {
    if (busy) return;
    setBusy(true);
    setApprovingId(requestId);
    setMsg("");
    const res = await fetch("/api/password/requests/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    setApprovingId(null);
    setMsg(res.ok ? "تمت الموافقة — يمكن للموظف تعيين كلمة المرور الآن" : json.error || "فشلت الموافقة");
    await loadResetRequests();
  }

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg("");
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        mobile: fd.get("mobile"),
        password: fd.get("password"),
        role: fd.get("role"),
      }),
    });
    const json = await res.json();
    setBusy(false);
    setMsg(res.ok ? "تم إنشاء المستخدم" : json.error || "فشل الإنشاء");
    if (res.ok) {
      e.currentTarget.reset();
      setOpen(false);
      await load();
    }
  }

  async function onEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !editing) return;
    setBusy(true);
    setMsg("");
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editing.id,
        name: fd.get("name"),
        mobile: fd.get("mobile"),
        role: fd.get("role"),
        active: fd.get("active") === "on",
      }),
    });
    const json = await res.json();
    setBusy(false);
    setMsg(res.ok ? "تم تحديث المستخدم" : json.error || "فشل التحديث");
    if (res.ok) {
      setEditing(null);
      await load();
    }
  }

  async function onChangePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !passwordFor) return;
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    const confirm = String(fd.get("confirm") ?? "");
    if (password.length < 8) {
      setMsg("كلمة المرور 8 أحرف على الأقل");
      return;
    }
    if (password !== confirm) {
      setMsg("كلمتا المرور غير متطابقتين");
      return;
    }
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: passwordFor.id, password }),
    });
    const json = await res.json();
    setBusy(false);
    setMsg(res.ok ? "تم تغيير كلمة المرور" : json.error || "فشل التغيير");
    if (res.ok) setPasswordFor(null);
  }

  async function onDelete() {
    if (busy || !deleting || deleteConfirmText.trim() !== "حذف") return;
    setBusy(true);
    setMsg("");
    const res = await fetch(`/api/users?id=${encodeURIComponent(deleting.id)}`, {
      method: "DELETE",
    });
    const json = await res.json();
    setBusy(false);
    setMsg(res.ok ? json.message || "تم حذف المستخدم" : json.error || "فشل الحذف");
    if (res.ok) {
      setDeleting(null);
      setDeleteConfirmText("");
      await load();
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="المستخدمون"
        description="إدارة حسابات الموظفين والصلاحيات"
        breadcrumb={[{ label: "الرئيسية", href: "/dashboard" }, { label: "المستخدمون" }]}
        actions={
          <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
            إضافة مستخدم
          </button>
        }
      />
      {msg ? <p className="msg">{msg}</p> : null}

      <section className="panel">
        <div className="toolbar" style={{ marginBottom: "var(--space-3)" }}>
          <h2 className="panel-title" style={{ margin: 0 }}>
            طلبات استعادة كلمة المرور ({resetRequests.length})
          </h2>
          <button
            type="button"
            className="btn-secondary btn-sm"
            disabled={busy}
            onClick={() => void loadResetRequests()}
          >
            تحديث
          </button>
        </div>
        {resetRequests.length ? (
          <div className="table-wrap table-wrap--stack">
            <table>
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>الجوال</th>
                  <th>المتبقي</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {resetRequests.map((r) => (
                  <tr key={r.id}>
                    <td data-label="الاسم">{r.user.name}</td>
                    <td data-label="الجوال" dir="ltr">
                      {r.user.mobile}
                    </td>
                    <td data-label="المتبقي" dir="ltr">
                      {Math.floor(r.expiresInSec / 60)}:
                      {String(r.expiresInSec % 60).padStart(2, "0")}
                    </td>
                    <td data-label="إجراء">
                      <button
                        type="button"
                        className="btn-primary btn-sm"
                        disabled={busy}
                        onClick={() => void approveReset(r.id)}
                      >
                        {approvingId === r.id ? "جاري…" : "موافقة"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="لا طلبات معلّقة"
            body="عند طلب موظف لاستعادة كلمة المرور يظهر هنا لمدة 5 دقائق."
          />
        )}
      </section>

      <section className="panel">
        <div className="toolbar" style={{ marginBottom: "var(--space-3)" }}>
          <h2 className="panel-title" style={{ margin: 0 }}>
            الحسابات ({total})
          </h2>
          <AvatarGroup names={users.map((u) => u.name)} max={5} />
        </div>
        <div className="table-wrap table-wrap--stack table-wrap--sticky-name">
          <table>
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الجوال</th>
                <th>الدور</th>
                <th>الحالة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td data-label="الاسم">{u.name}</td>
                  <td data-label="الجوال" dir="ltr">
                    {u.mobile}
                  </td>
                  <td data-label="الدور">{ROLE_LABELS[u.role]}</td>
                  <td data-label="الحالة">
                    <span className={`badge ${u.active ? "badge-success" : "badge-danger"}`}>
                      {u.active ? "نشط" : "موقوف"}
                    </span>
                  </td>
                  <td data-label="إجراءات">
                    <div className="row-actions">
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => setEditing(u)}
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => setPasswordFor(u)}
                      >
                        كلمة المرور
                      </button>
                      <button
                        type="button"
                        className="btn-danger btn-sm"
                        onClick={() => {
                          setDeleteConfirmText("");
                          setDeleting(u);
                        }}
                      >
                        حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!users.length ? <EmptyState title="لا مستخدمون" body="أضف أول حساب موظف." /> : null}
        <PaginationBar
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={DEFAULT_PAGE_SIZE}
          busy={busy}
          onPageChange={(p) => void load(p)}
        />
      </section>

      <Modal open={open} title="إضافة مستخدم" onClose={() => !busy && setOpen(false)}>
        <form onSubmit={onCreate}>
          <div className="form-grid">
            <div>
              <label className="label-field">الاسم</label>
              <input name="name" className="input-field" required />
            </div>
            <div>
              <label className="label-field">الجوال</label>
              <input name="mobile" className="input-field" dir="ltr" required />
            </div>
            <div>
              <label className="label-field">كلمة المرور</label>
              <PasswordField name="password" required autoComplete="new-password" />
            </div>
            <div>
              <label className="label-field">الدور</label>
              <select name="role" className="input-field" required defaultValue="RECEPTION">
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? "جاري الحفظ…" : "حفظ"}
            </button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => setOpen(false)}>
              إلغاء
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!editing}
        title={`تعديل المستخدم: ${editing?.name ?? ""}`}
        onClose={() => !busy && setEditing(null)}
      >
        <form onSubmit={onEdit} key={editing?.id ?? "none"}>
          <div className="form-grid">
            <div>
              <label className="label-field">الاسم</label>
              <input name="name" className="input-field" required defaultValue={editing?.name ?? ""} />
            </div>
            <div>
              <label className="label-field">الجوال</label>
              <input
                name="mobile"
                className="input-field"
                dir="ltr"
                required
                defaultValue={editing?.mobile ?? ""}
              />
            </div>
            <div>
              <label className="label-field">الدور</label>
              <select name="role" className="input-field" required defaultValue={editing?.role}>
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input id="user-active" name="active" type="checkbox" defaultChecked={editing?.active} />
              <label htmlFor="user-active">حساب نشط</label>
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? "جاري الحفظ…" : "حفظ التعديلات"}
            </button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => setEditing(null)}>
              إلغاء
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!passwordFor}
        title={`تغيير كلمة المرور: ${passwordFor?.name ?? ""}`}
        onClose={() => !busy && setPasswordFor(null)}
      >
        <form onSubmit={onChangePassword} key={passwordFor?.id ?? "none"}>
          <div className="form-grid">
            <div>
              <label className="label-field">كلمة المرور الجديدة</label>
              <PasswordField name="password" minLength={8} required autoComplete="new-password" />
            </div>
            <div>
              <label className="label-field">تأكيد كلمة المرور</label>
              <PasswordField name="confirm" minLength={8} required autoComplete="new-password" />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? "جاري…" : "تغيير كلمة المرور"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => setPasswordFor(null)}
            >
              إلغاء
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!deleting}
        title={`حذف المستخدم: ${deleting?.name ?? ""}`}
        onClose={() => !busy && setDeleting(null)}
      >
        <p className="msg msg-error">
          تأكيد ثنائي: إذا كان للمستخدم عمليات مسجلة يوقَّف بدل الحذف حفاظاً على السجل. اكتب «حذف» ثم أكّد.
        </p>
        <input
          className="input-field"
          value={deleteConfirmText}
          onChange={(e) => setDeleteConfirmText(e.target.value)}
          placeholder="اكتب: حذف"
        />
        <div className="form-actions">
          <button
            type="button"
            className="btn-danger"
            disabled={busy || deleteConfirmText.trim() !== "حذف"}
            onClick={onDelete}
          >
            {busy ? "جاري الحذف…" : "تأكيد الحذف"}
          </button>
          <button type="button" className="btn-secondary" onClick={() => setDeleting(null)}>
            إلغاء
          </button>
        </div>
      </Modal>
    </div>
  );
}

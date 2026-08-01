"use client";

import { FormEvent, useEffect, useState } from "react";
import { ROLE_LABELS } from "@/lib/rbac";
import { PageHeader } from "@/components/PageHeader";
import { Modal } from "@/components/Modal";

type UserRow = {
  id: string;
  name: string;
  mobile: string;
  role: keyof typeof ROLE_LABELS;
  active: boolean;
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [passwordFor, setPasswordFor] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/users");
    const json = await res.json();
    if (res.ok) setUsers(json.data);
  }

  useEffect(() => {
    void load();
  }, []);

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
        actions={
          <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
            إضافة مستخدم
          </button>
        }
      />
      {msg ? <p className="msg">{msg}</p> : null}

      <section className="panel">
        <h2 className="panel-title">الحسابات</h2>
        <div className="table-wrap">
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
                  <td>{u.name}</td>
                  <td dir="ltr">{u.mobile}</td>
                  <td>{ROLE_LABELS[u.role]}</td>
                  <td>
                    <span className={`badge ${u.active ? "badge-success" : "badge-danger"}`}>
                      {u.active ? "نشط" : "موقوف"}
                    </span>
                  </td>
                  <td>
                    <div className="toolbar" style={{ gap: "0.4rem" }}>
                      <button type="button" className="btn-secondary" onClick={() => setEditing(u)}>
                        تعديل
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setPasswordFor(u)}
                      >
                        كلمة المرور
                      </button>
                      <button
                        type="button"
                        className="btn-danger"
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
              <input name="password" type="password" className="input-field" dir="ltr" required />
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
              <input
                name="password"
                type="password"
                className="input-field"
                dir="ltr"
                minLength={8}
                required
              />
            </div>
            <div>
              <label className="label-field">تأكيد كلمة المرور</label>
              <input
                name="confirm"
                type="password"
                className="input-field"
                dir="ltr"
                minLength={8}
                required
              />
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

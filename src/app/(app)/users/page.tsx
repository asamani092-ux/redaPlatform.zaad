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
    </div>
  );
}

"use client";

import { FormEvent, useEffect, useState } from "react";
import { ROLE_LABELS } from "@/lib/rbac";
import { PageHeader } from "@/components/PageHeader";

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

  async function load() {
    const res = await fetch("/api/users");
    const json = await res.json();
    if (res.ok) setUsers(json.data);
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
    setMsg(res.ok ? "تم إنشاء المستخدم" : json.error);
    if (res.ok) {
      e.currentTarget.reset();
      load();
    }
  }

  return (
    <div className="page-stack">
      <PageHeader title="المستخدمون" description="إدارة حسابات الموظفين والصلاحيات" />
      {msg ? <p className="msg">{msg}</p> : null}

      <section className="panel">
        <h2 className="panel-title">إضافة مستخدم</h2>
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
              <select name="role" className="input-field" required>
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-primary" type="submit">
              إضافة مستخدم
            </button>
          </div>
        </form>
      </section>

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
    </div>
  );
}

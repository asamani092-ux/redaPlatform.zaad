"use client";

import { FormEvent, useEffect, useState } from "react";
import { ROLE_LABELS } from "@/lib/rbac";

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
    <div className="space-y-4">
      <div className="panel">
        <h1 className="text-2xl font-extrabold text-primary mb-3">المستخدمون</h1>
        {msg ? <p className="mb-3 font-semibold text-primary">{msg}</p> : null}
        <form onSubmit={onCreate} className="grid md:grid-cols-2 gap-3">
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
          <div className="md:col-span-2">
            <button className="btn-primary" type="submit">
              إضافة مستخدم
            </button>
          </div>
        </form>
      </div>
      <div className="panel">
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
      </div>
    </div>
  );
}

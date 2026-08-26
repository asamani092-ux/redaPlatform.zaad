"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";

type RoleOpt = { id: string; name: string; active: boolean };
type Volunteer = {
  id: string;
  name: string;
  mobile: string;
  nationalId: string;
  roleId: string;
  thanksSentAt: string | null;
  role: RoleOpt;
};

/**
 * إدارة متطوعي المعرض النشط.
 * Time: O(n) للعرض؛ الإضافة O(1).
 */
export default function VolunteersPage() {
  const [rows, setRows] = useState<Volunteer[]>([]);
  const [roles, setRoles] = useState<RoleOpt[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    mobile: "",
    nationalId: "",
    roleId: "",
    sendThanks: true,
  });

  async function load() {
    const [vRes, rRes] = await Promise.all([
      fetch("/api/volunteers"),
      fetch("/api/volunteer-roles?active=1"),
    ]);
    const vJson = await vRes.json();
    const rJson = await rRes.json();
    if (vRes.ok) setRows(vJson.data ?? []);
    if (rRes.ok) {
      const list = (rJson.data ?? []) as RoleOpt[];
      setRoles(list);
      setForm((f) => ({ ...f, roleId: f.roleId || list[0]?.id || "" }));
    }
    if (!vRes.ok) setMsg(vJson.error || "تعذر التحميل");
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/volunteers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(json.error || "فشل الحفظ");
      return;
    }
    setMsg(
      form.sendThanks
        ? `تمت الإضافة${json.thanksStatus ? ` — واتساب: ${json.thanksStatus}` : ""}`
        : "تمت إضافة المتطوع",
    );
    setForm((f) => ({
      ...f,
      name: "",
      mobile: "",
      nationalId: "",
      sendThanks: true,
    }));
    await load();
  }

  async function sendThanks(id: string) {
    if (busy) return;
    setBusy(true);
    const res = await fetch("/api/volunteers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, sendThanks: true }),
    });
    const json = await res.json();
    setBusy(false);
    setMsg(res.ok ? `تم إرسال الشكر (${json.thanksStatus ?? "ok"})` : json.error || "فشل");
    if (res.ok) await load();
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`حذف المتطوع «${name}»؟`)) return;
    if (!window.confirm("تأكيد نهائي: سيتم حذف السجل.")) return;
    const res = await fetch(`/api/volunteers?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const json = await res.json();
    setMsg(res.ok ? "تم الحذف" : json.error || "فشل الحذف");
    if (res.ok) await load();
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="المتطوعون"
        description="تسجيل متطوعي المعرض النشط وإرسال رسالة شكر"
      />
      {msg ? <p className="msg">{msg}</p> : null}

      <section className="panel">
        <h2 className="panel-title">إضافة متطوع</h2>
        {!roles.length ? (
          <p className="page-header__desc">
            لا توجد أدوار نشطة — أضف أدوار المتطوعين من الإعدادات أولاً.
          </p>
        ) : (
          <form onSubmit={onCreate} className="form-grid">
            <div>
              <label className="label-field">الاسم</label>
              <input
                className="input-field"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="label-field">الجوال</label>
              <input
                className="input-field"
                required
                dir="ltr"
                inputMode="tel"
                value={form.mobile}
                onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
              />
            </div>
            <div>
              <label className="label-field">رقم الهوية</label>
              <input
                className="input-field"
                required
                dir="ltr"
                inputMode="numeric"
                minLength={10}
                maxLength={14}
                value={form.nationalId}
                onChange={(e) => setForm((f) => ({ ...f, nationalId: e.target.value }))}
              />
            </div>
            <div>
              <label className="label-field">الدور</label>
              <select
                className="input-field"
                required
                value={form.roleId}
                onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))}
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="full" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                id="sendThanks"
                type="checkbox"
                checked={form.sendThanks}
                onChange={(e) => setForm((f) => ({ ...f, sendThanks: e.target.checked }))}
              />
              <label htmlFor="sendThanks" className="label-field" style={{ margin: 0 }}>
                إرسال رسالة شكر عبر واتساب عند الحفظ
              </label>
            </div>
            <div className="form-actions full">
              <button className="btn-primary" type="submit" disabled={busy}>
                {busy ? "جاري…" : "حفظ المتطوع"}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="panel">
        <h2 className="panel-title">قائمة المتطوعين ({rows.length})</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الهوية</th>
                <th>الجوال</th>
                <th>الدور</th>
                <th>الشكر</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td dir="ltr">{r.nationalId}</td>
                  <td dir="ltr">{r.mobile}</td>
                  <td>{r.role?.name ?? "—"}</td>
                  <td>{r.thanksSentAt ? "أُرسل" : "—"}</td>
                  <td>
                    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={busy}
                        onClick={() => void sendThanks(r.id)}
                      >
                        شكر واتساب
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => void remove(r.id, r.name)}
                      >
                        حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={6} className="empty">
                    لا متطوعين بعد
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

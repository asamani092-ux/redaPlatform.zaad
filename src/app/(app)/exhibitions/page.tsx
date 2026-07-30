"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Modal } from "@/components/Modal";

type ExhibitionRow = {
  id: string;
  name: string;
  location?: string | null;
  active: boolean;
  startsAt?: string | null;
};

export default function ExhibitionsPage() {
  const [rows, setRows] = useState<ExhibitionRow[]>([]);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

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
        activate: fd.get("activate") === "on",
      }),
    });
    const json = await res.json();
    setBusy(false);
    setMsg(res.ok ? "تم إنشاء المعرض" : json.error || "فشل الإنشاء");
    if (res.ok) {
      setOpen(false);
      e.currentTarget.reset();
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
    if (res.ok) load();
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="المعارض"
        description="إنشاء معارض بأسماء فريدة وتفعيل معرض تشغيل واحد فقط"
        actions={
          <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
            إضافة معرض
          </button>
        }
      />
      {msg ? <p className="msg">{msg}</p> : null}

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الموقع</th>
                <th>الحالة</th>
                <th>إجراء</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.location || "—"}</td>
                  <td>
                    <span className={`badge ${r.active ? "badge-success" : "badge-muted"}`}>
                      {r.active ? "نشط" : "غير نشط"}
                    </span>
                  </td>
                  <td>
                    {r.active ? (
                      "—"
                    ) : (
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={busy}
                        onClick={() => activate(r.id)}
                      >
                        تفعيل
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={4} className="empty">
                    لا معارض بعد — أضف معرضاً للبدء
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
    </div>
  );
}

"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";

type Association = { id: string; name: string };
type Beneficiary = {
  id: string;
  name: string;
  nationalId: string;
  mobile: string;
  gender?: string | null;
  city?: string | null;
  neighborhood?: string | null;
  statusLabel?: string;
  association?: Association | null;
  associationOther?: string | null;
};

export default function BeneficiariesPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Beneficiary[]>([]);
  const [associations, setAssociations] = useState<Association[]>([]);
  const [msg, setMsg] = useState("");
  const [useOther, setUseOther] = useState(false);

  async function load(search = q) {
    const res = await fetch(`/api/beneficiaries?q=${encodeURIComponent(search)}`);
    const json = await res.json();
    if (res.ok) setRows(json.data);
  }

  useEffect(() => {
    load();
    fetch("/api/associations")
      .then((r) => r.json())
      .then((j) => setAssociations(j.data ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg("");
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") ?? ""),
      nationalId: String(fd.get("nationalId") ?? ""),
      mobile: String(fd.get("mobile") ?? ""),
      gender: String(fd.get("gender") || "") || null,
      city: String(fd.get("city") || "") || null,
      neighborhood: String(fd.get("neighborhood") || "") || null,
      birthDate: String(fd.get("birthDate") || "") || null,
      notes: String(fd.get("notes") || "") || null,
      associationId: useOther ? null : String(fd.get("associationId") || "") || null,
      associationOther: useOther ? String(fd.get("associationOther") || "") || null : null,
    };
    const res = await fetch("/api/beneficiaries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setMsg(res.ok ? "تم الحفظ" : json.error || "فشل الحفظ");
    if (res.ok) {
      e.currentTarget.reset();
      setUseOther(false);
      load();
    }
  }

  async function onImport(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/beneficiaries/import", { method: "POST", body: fd });
    const json = await res.json();
    setMsg(res.ok ? `استيراد: ${json.created} ناجح / ${json.skipped} متجاوز` : json.error);
    if (res.ok) load();
  }

  return (
    <div className="page-stack">
      <PageHeader title="المستفيدون" description="تسجيل وبحث واستيراد بيانات المستفيدين" />
      {msg ? <p className={`msg ${msg.includes("فشل") || msg.includes("غير") ? "msg-error" : ""}`}>{msg}</p> : null}

      <section className="panel">
        <h2 className="panel-title">بحث</h2>
        <div className="toolbar">
          <input
            className="input-field"
            placeholder="الاسم / الهوية / الجوال"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button type="button" className="btn-primary" onClick={() => load(q)}>
            بحث
          </button>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">إضافة مستفيد</h2>
        <form onSubmit={onCreate}>
          <div className="form-grid">
            <div>
              <label className="label-field">الاسم</label>
              <input name="name" className="input-field" required />
            </div>
            <div>
              <label className="label-field">رقم الهوية</label>
              <input name="nationalId" className="input-field" dir="ltr" required />
            </div>
            <div>
              <label className="label-field">الجوال</label>
              <input name="mobile" className="input-field" dir="ltr" required />
            </div>
            <div>
              <label className="label-field">الجنس</label>
              <select name="gender" className="input-field">
                <option value="">—</option>
                <option value="MALE">ذكر</option>
                <option value="FEMALE">أنثى</option>
              </select>
            </div>
            <div>
              <label className="label-field">المدينة</label>
              <input name="city" className="input-field" />
            </div>
            <div>
              <label className="label-field">الحي</label>
              <input name="neighborhood" className="input-field" />
            </div>
            <div>
              <label className="label-field">تاريخ الميلاد</label>
              <input name="birthDate" type="date" className="input-field" dir="ltr" />
            </div>
            <div>
              <label className="label-field">الجمعية</label>
              <select
                name="associationId"
                className="input-field"
                disabled={useOther}
                onChange={(e) => {
                  if (e.target.value === "__other__") setUseOther(true);
                }}
              >
                <option value="">—</option>
                {associations.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
                <option value="__other__">أخرى</option>
              </select>
              {useOther ? (
                <input
                  name="associationOther"
                  className="input-field"
                  style={{ marginTop: "0.5rem" }}
                  placeholder="اسم الجمعية"
                  required
                />
              ) : null}
            </div>
            <div className="full">
              <label className="label-field">ملاحظات</label>
              <textarea name="notes" className="input-field" rows={2} />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-primary" type="submit">
              إضافة مستفيد
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2 className="panel-title">استيراد Excel</h2>
        <form onSubmit={onImport} className="toolbar">
          <input type="file" name="file" accept=".xlsx,.xls,.csv" required className="input-field" />
          <button className="btn-secondary" type="submit">
            استيراد
          </button>
        </form>
      </section>

      <section className="panel">
        <h2 className="panel-title">القائمة ({rows.length})</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الهوية</th>
                <th>الجوال</th>
                <th>الجمعية</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td dir="ltr">{r.nationalId}</td>
                  <td dir="ltr">{r.mobile}</td>
                  <td>{r.association?.name ?? r.associationOther ?? "—"}</td>
                  <td>
                    <span className="badge badge-muted">{r.statusLabel}</span>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={5} className="empty">
                    لا توجد نتائج
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

"use client";

import { FormEvent, useEffect, useState } from "react";

type Recent = {
  id: string;
  type: string;
  checkedInAt: string;
  exceptionReason?: string | null;
  beneficiary: { name: string; nationalId: string };
};

export default function AttendancePage() {
  const [count, setCount] = useState(0);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [msg, setMsg] = useState("");
  const [preview, setPreview] = useState<{ name: string; nationalId: string } | null>(null);
  const [needsException, setNeedsException] = useState(false);

  async function refresh() {
    const res = await fetch("/api/attendance");
    const json = await res.json();
    if (res.ok) {
      setCount(json.count);
      setRecent(json.recent);
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg("");
    setPreview(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      qrToken: String(fd.get("qrToken") || "") || undefined,
      nationalId: String(fd.get("nationalId") || "") || undefined,
      exception: needsException || fd.get("exception") === "on",
      exceptionReason: String(fd.get("exceptionReason") || "") || undefined,
    };
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (res.status === 403 && json.beneficiary) {
      setNeedsException(true);
      setPreview({ name: json.beneficiary.name, nationalId: json.beneficiary.nationalId });
      setMsg(json.error);
      return;
    }
    if (!res.ok) {
      setMsg(json.error || "فشل التسجيل");
      if (json.data?.beneficiary) {
        setPreview({
          name: json.data.beneficiary.name,
          nationalId: json.data.beneficiary.nationalId,
        });
      }
      return;
    }
    setMsg("تم تسجيل الحضور");
    setPreview(json.data.beneficiary);
    setNeedsException(false);
    e.currentTarget.reset();
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="panel">
        <h1 className="text-2xl font-extrabold text-primary">تسجيل الحضور</h1>
        <p className="mt-2 text-3xl font-extrabold text-secondary-dark">الحاضرون الآن: {count}</p>
      </div>
      <div className="panel">
        <form onSubmit={submit} className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="label-field">رمز QR الداخلي</label>
            <input name="qrToken" className="input-field" dir="ltr" placeholder="امسح أو الصق الرمز" />
          </div>
          <div>
            <label className="label-field">أو رقم الهوية</label>
            <input name="nationalId" className="input-field" dir="ltr" />
          </div>
          {(needsException || true) && (
            <>
              <div className="md:col-span-2 flex items-center gap-2">
                <input id="exception" name="exception" type="checkbox" checked={needsException} onChange={(e) => setNeedsException(e.target.checked)} />
                <label htmlFor="exception">تسجيل كاستثناء (بديل الحضور الاعتيادي)</label>
              </div>
              {needsException ? (
                <div className="md:col-span-2">
                  <label className="label-field">سبب الاستثناء</label>
                  <input name="exceptionReason" className="input-field" required={needsException} />
                </div>
              ) : null}
            </>
          )}
          <div className="md:col-span-2">
            <button className="btn-primary" type="submit">
              تأكيد الحضور
            </button>
          </div>
        </form>
        {msg ? <p className="mt-3 font-semibold text-primary">{msg}</p> : null}
        {preview ? (
          <div className="mt-3 p-3 rounded-lg bg-surface-muted">
            <div className="font-bold">{preview.name}</div>
            <div dir="ltr">{preview.nationalId}</div>
          </div>
        ) : null}
      </div>
      <div className="panel">
        <h2 className="font-bold text-primary mb-3">آخر التسجيلات</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الهوية</th>
                <th>النوع</th>
                <th>الوقت</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}>
                  <td>{r.beneficiary.name}</td>
                  <td dir="ltr">{r.beneficiary.nationalId}</td>
                  <td>{r.type === "EXCEPTION" ? `استثناء: ${r.exceptionReason}` : "عادي"}</td>
                  <td>{new Date(r.checkedInAt).toLocaleString("ar-SA")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

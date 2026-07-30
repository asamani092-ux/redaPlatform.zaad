"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { BeneficiaryCard } from "@/components/BeneficiaryCard";

type Recent = {
  id: string;
  type: string;
  checkedInAt: string;
  exceptionReason?: string | null;
  beneficiary: { name: string; nationalId: string };
};

type Lookup = {
  beneficiary: {
    id: string;
    name: string;
    nationalId: string;
    mobile: string;
    association?: string | null;
  };
  statusLabel: string;
  invite: { invited: boolean; qrToken: string } | null;
  attendance: { type: string } | null;
};

export default function AttendancePage() {
  const [count, setCount] = useState(0);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [msg, setMsg] = useState("");
  const [scanOn, setScanOn] = useState(false);
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [qrToken, setQrToken] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [needsException, setNeedsException] = useState(false);
  const [exceptionReason, setExceptionReason] = useState("");
  const [busy, setBusy] = useState(false);

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

  const preview = useCallback(async (params: { qrToken?: string; q?: string }) => {
    setMsg("");
    const qs = new URLSearchParams();
    if (params.qrToken) qs.set("qrToken", params.qrToken);
    if (params.q) qs.set("q", params.q);
    const res = await fetch(`/api/lookup?${qs}`);
    const json = await res.json();
    if (!res.ok) {
      setLookup(null);
      setMsg(json.error || "تعذر الجلب");
      return;
    }
    setLookup(json);
    setQrToken(json.invite?.qrToken || params.qrToken || "");
    setNationalId(json.beneficiary.nationalId);
    setNeedsException(!json.invite?.invited);
  }, []);

  const onScan = useCallback(
    (value: string) => {
      setScanOn(false);
      setQrToken(value);
      preview({ qrToken: value });
    },
    [preview],
  );

  async function confirmCheckIn() {
    if (busy || !lookup) return;
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        qrToken: qrToken || undefined,
        beneficiaryId: lookup.beneficiary.id,
        nationalId: nationalId || undefined,
        exception: needsException,
        exceptionReason: needsException ? exceptionReason : undefined,
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (res.status === 403) {
      setNeedsException(true);
      setMsg(json.error);
      return;
    }
    if (!res.ok) {
      setMsg(json.error || "فشل التسجيل");
      return;
    }
    setMsg("تم تسجيل الحضور");
    setLookup(null);
    setQrToken("");
    setNationalId("");
    setNeedsException(false);
    setExceptionReason("");
    refresh();
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="تسجيل الحضور"
        description="امسح الرمز أو ابحث ثم أكّد بعد ظهور بيانات المستفيد"
        actions={
          <button type="button" className="btn-recommend" onClick={() => setScanOn((v) => !v)}>
            {scanOn ? "إيقاف الكاميرا" : "مسح بالكاميرا"}
          </button>
        }
      />

      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <div className="stat-tile">
          <div className="value">{count}</div>
          <div className="label">الحاضرون الآن</div>
        </div>
      </div>

      {msg ? <p className="msg">{msg}</p> : null}

      <section className="panel">
        <h2 className="panel-title">المسح / البحث</h2>
        {scanOn ? <BarcodeScanner active={scanOn} onScan={onScan} /> : null}
        <div className="form-grid" style={{ marginTop: scanOn ? "1rem" : 0 }}>
          <div>
            <label className="label-field">رمز QR</label>
            <input
              className="input-field"
              dir="ltr"
              value={qrToken}
              onChange={(e) => setQrToken(e.target.value)}
            />
          </div>
          <div>
            <label className="label-field">أو رقم الهوية</label>
            <input
              className="input-field"
              dir="ltr"
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value)}
            />
          </div>
        </div>
        <div className="form-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              preview({
                qrToken: qrToken || undefined,
                q: !qrToken ? nationalId || undefined : undefined,
              })
            }
          >
            معاينة المستفيد
          </button>
        </div>
      </section>

      {lookup ? (
        <section className="panel">
          <h2 className="panel-title">تأكيد التسجيل</h2>
          <BeneficiaryCard
            name={lookup.beneficiary.name}
            nationalId={lookup.beneficiary.nationalId}
            mobile={lookup.beneficiary.mobile}
            association={lookup.beneficiary.association}
            statusLabel={lookup.statusLabel}
            extra={
              lookup.attendance ? (
                <span className="badge badge-warning">سبق الحضور</span>
              ) : null
            }
          />
          <div className="form-grid" style={{ marginTop: "1rem" }}>
            <div className="full" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                id="exception"
                type="checkbox"
                checked={needsException}
                onChange={(e) => setNeedsException(e.target.checked)}
              />
              <label htmlFor="exception">تسجيل كاستثناء</label>
            </div>
            {needsException ? (
              <div className="full">
                <label className="label-field">سبب الاستثناء</label>
                <input
                  className="input-field"
                  value={exceptionReason}
                  onChange={(e) => setExceptionReason(e.target.value)}
                  required
                />
              </div>
            ) : null}
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="btn-primary"
              disabled={busy || !!lookup.attendance}
              onClick={confirmCheckIn}
            >
              {busy ? "جاري..." : "تأكيد الحضور"}
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <h2 className="panel-title">آخر التسجيلات</h2>
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
      </section>
    </div>
  );
}

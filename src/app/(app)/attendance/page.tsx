"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { BeneficiaryCard } from "@/components/BeneficiaryCard";
import { PaginationBar } from "@/components/PaginationBar";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Stepper } from "@/components/ui/Stepper";
import { useToast } from "@/components/ui/Toast";

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
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageRef = useRef(1);
  const [msg, setMsg] = useState("");
  const [msgError, setMsgError] = useState(false);
  const [scanOn, setScanOn] = useState(false);
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [qrToken, setQrToken] = useState("");
  const [q, setQ] = useState("");
  const [needsException, setNeedsException] = useState(false);
  const [exceptionReason, setExceptionReason] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function refresh(p = pageRef.current) {
    const res = await fetch(`/api/attendance?page=${p}&pageSize=${DEFAULT_PAGE_SIZE}`);
    const json = await res.json();
    if (res.ok) {
      setCount(json.count ?? 0);
      setRecent(json.recent ?? []);
      const nextPage = json.page ?? p;
      pageRef.current = nextPage;
      setPage(nextPage);
      setTotalPages(json.totalPages ?? 1);
    }
  }

  useEffect(() => {
    void refresh(1);
    const t = setInterval(() => void refresh(), 10000);
    return () => clearInterval(t);
  }, []);

  const preview = useCallback(async (params: { qrToken?: string; q?: string }) => {
    setMsg("");
    setMsgError(false);
    const qs = new URLSearchParams();
    if (params.qrToken) qs.set("qrToken", params.qrToken);
    if (params.q) qs.set("q", params.q);
    const res = await fetch(`/api/lookup?${qs}`);
    const json = await res.json();
    if (!res.ok) {
      setLookup(null);
      setMsg(json.error || "تعذر الجلب");
      setMsgError(true);
      return;
    }
    setLookup(json);
    setQrToken(json.invite?.qrToken || params.qrToken || "");
    setQ(json.beneficiary.nationalId);
    setNeedsException(!json.invite?.invited);
    setExceptionReason("");
  }, []);

  // الكاميرا تبقى تعمل للمسح المتتابع — لا تُغلق بعد كل قراءة
  const onScan = useCallback(
    (value: string) => {
      setQrToken(value);
      preview({ qrToken: value });
    },
    [preview],
  );

  const notInvited = Boolean(lookup && !lookup.invite?.invited);
  const alreadyHere = Boolean(lookup?.attendance);
  const exceptionForced = notInvited;
  const exceptionActive = exceptionForced || needsException;
  const attendanceBlock = !lookup
    ? null
    : alreadyHere
      ? "سبق تسجيل حضور هذا المستفيد"
      : exceptionActive && !exceptionReason.trim()
        ? "سبب الاستثناء مطلوب لغير المدعوين"
        : null;

  async function confirmCheckIn() {
    if (busy || !lookup) return;
    if (attendanceBlock) {
      setMsg(attendanceBlock);
      setMsgError(true);
      return;
    }
    setBusy(true);
    setMsg("");
    setMsgError(false);
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        qrToken: qrToken || undefined,
        beneficiaryId: lookup.beneficiary.id,
        exception: exceptionActive,
        exceptionReason: exceptionActive ? exceptionReason : undefined,
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (res.status === 403) {
      setNeedsException(true);
      setMsg(json.error);
      setMsgError(true);
      return;
    }
    if (!res.ok) {
      const err = json.error || "فشل التسجيل";
      setMsg(err);
      setMsgError(true);
      toast.push({ title: err, tone: "danger" });
      return;
    }
    // تنبيه واحد فقط للنجاح
    setMsg("");
    setMsgError(false);
    toast.push({ title: "تم تسجيل الحضور", tone: "success" });
    setLookup(null);
    setQrToken("");
    setQ("");
    setNeedsException(false);
    setExceptionReason("");
    refresh();
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="تسجيل الحضور"
        description="امسح بالكاميرا أو ابحث بالهوية أو الجوال ثم أكّد بعد ظهور بيانات المستفيد"
        breadcrumb={[{ label: "الرئيسية", href: "/dashboard" }, { label: "الحضور" }]}
        actions={
          <button type="button" className="btn-recommend" onClick={() => setScanOn((v) => !v)}>
            {scanOn ? "إيقاف الكاميرا" : "مسح بالكاميرا"}
          </button>
        }
      />

      <Stepper
        steps={[
          { id: "scan", label: "مسح / بحث" },
          { id: "preview", label: "معاينة" },
          { id: "confirm", label: "تأكيد" },
        ]}
        currentId={lookup ? "confirm" : (q || qrToken || scanOn) ? "preview" : "scan"}
      />

      <div className="stat-grid">
        <KpiCard label="الحاضرون الآن" value={count} />
      </div>

      {msg ? <p className={`msg ${msgError ? "msg-error" : ""}`}>{msg}</p> : null}

      <section className="panel">
        <h2 className="panel-title">المسح / البحث</h2>
        {scanOn ? <BarcodeScanner active={scanOn} onScan={onScan} /> : null}
        <div className="toolbar" style={{ marginTop: scanOn ? "1rem" : 0 }}>
          <input
            className="input-field"
            placeholder="رقم الهوية / الجوال / الاسم"
            dir="ltr"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setQrToken("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (q.trim()) void preview({ q: q.trim() });
              }
            }}
          />
          <button
            type="button"
            className="btn-primary"
            onClick={() => q.trim() && preview({ q: q.trim() })}
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
                <span className="badge badge-success">تم تسجيل الحضور</span>
              ) : null
            }
          />
          <div className="form-grid" style={{ marginTop: "1rem" }}>
            <div className="full" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                id="exception"
                type="checkbox"
                checked={exceptionActive}
                disabled={exceptionForced || alreadyHere}
                onChange={(e) => setNeedsException(e.target.checked)}
              />
              <label htmlFor="exception">
                تسجيل كاستثناء
                {exceptionForced ? " (إلزامي — غير مدعو)" : ""}
              </label>
            </div>
            {exceptionActive ? (
              <div className="full">
                <label className="label-field">سبب الاستثناء</label>
                <input
                  className="input-field"
                  value={exceptionReason}
                  onChange={(e) => setExceptionReason(e.target.value)}
                  required
                  disabled={alreadyHere}
                />
              </div>
            ) : null}
          </div>
          {attendanceBlock ? <p className="msg msg-error">{attendanceBlock}</p> : null}
          <div className="form-actions">
            <button
              type="button"
              className="btn-primary"
              disabled={busy || Boolean(attendanceBlock)}
              title={attendanceBlock ?? undefined}
              onClick={() => void confirmCheckIn()}
            >
              {busy ? "جاري..." : alreadyHere ? "مسجّل مسبقاً" : "تأكيد الحضور"}
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <h2 className="panel-title">آخر التسجيلات ({count})</h2>
        <div className="table-wrap table-wrap--stack table-wrap--sticky-name">
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
                  <td data-label="الاسم">{r.beneficiary.name}</td>
                  <td data-label="الهوية" dir="ltr">
                    {r.beneficiary.nationalId}
                  </td>
                  <td data-label="النوع">
                    {r.type === "EXCEPTION" ? `استثناء: ${r.exceptionReason}` : "عادي"}
                  </td>
                  <td data-label="الوقت">{new Date(r.checkedInAt).toLocaleString("ar-SA")}</td>
                </tr>
              ))}
              {!recent.length ? (
                <tr>
                  <td colSpan={4}>
                    <EmptyState title="لا تسجيلات بعد" body="ستظهر هنا آخر عمليات الحضور." />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <PaginationBar
          page={page}
          totalPages={totalPages}
          total={count}
          pageSize={DEFAULT_PAGE_SIZE}
          busy={busy}
          onPageChange={(p) => void refresh(p)}
        />
      </section>
    </div>
  );
}

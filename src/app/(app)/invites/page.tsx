"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";

type Row = {
  id: string;
  name: string;
  nationalId: string;
  mobile: string;
  statusLabel?: string;
  qrToken?: string | null;
};

/**
 * الدعوات = إنشاء رمز QR + إرساله واتساباً. لا مسار «دعوة صامتة».
 * Time: O(n) على المحددين عند الإرسال.
 */
export default function InvitesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch(`/api/beneficiaries?q=${encodeURIComponent(q)}`);
    const json = await res.json();
    if (res.ok) setRows(json.data);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedIds = Object.entries(selected)
    .filter(([, v]) => v)
    .map(([id]) => id);

  async function inviteAndSend() {
    if (!selectedIds.length) {
      setMsg("حدد مستفيدين أولاً");
      return;
    }
    if (busy) return;
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ beneficiaryIds: selectedIds, sendWhatsApp: true }),
    });
    const json = await res.json();
    setBusy(false);
    setMsg(
      res.ok
        ? `تمت دعوة ${json.invited} مستفيد وإرسال رمز QR عبر واتساب`
        : json.error || "فشلت الدعوة",
    );
    if (res.ok) {
      setSelected({});
      load();
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="الدعوات الجماعية"
        description="تحديد المستفيدين ثم إرسال الدعوة مع رمز QR عبر واتساب — هذا هو مسار الدعوة الوحيد"
        actions={
          <button
            className="btn-primary"
            type="button"
            disabled={busy || !selectedIds.length}
            onClick={inviteAndSend}
          >
            {busy ? "جاري الإرسال…" : `دعوة وإرسال QR واتساب (${selectedIds.length})`}
          </button>
        }
      />
      {msg ? <p className="msg">{msg}</p> : null}

      <section className="panel">
        <div className="toolbar">
          <input
            className="input-field"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="تصفية بالاسم أو الهوية"
          />
          <button className="btn-secondary" type="button" onClick={load}>
            تحديث
          </button>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">المستفيدون</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      const next: Record<string, boolean> = {};
                      if (e.target.checked) rows.forEach((r) => (next[r.id] = true));
                      setSelected(next);
                    }}
                  />
                </th>
                <th>الاسم</th>
                <th>الهوية</th>
                <th>الجوال</th>
                <th>الحالة</th>
                <th>QR</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={!!selected[r.id]}
                      onChange={(e) => setSelected((s) => ({ ...s, [r.id]: e.target.checked }))}
                    />
                  </td>
                  <td>{r.name}</td>
                  <td dir="ltr">{r.nationalId}</td>
                  <td dir="ltr">{r.mobile}</td>
                  <td>
                    <span className="badge badge-muted">{r.statusLabel}</span>
                  </td>
                  <td>
                    {r.qrToken ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/qr/${r.qrToken}`} alt="QR" width={52} height={52} />
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={6} className="empty">
                    لا توجد بيانات
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

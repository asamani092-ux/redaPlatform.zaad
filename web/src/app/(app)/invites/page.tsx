"use client";

import { useEffect, useState } from "react";

type Row = {
  id: string;
  name: string;
  nationalId: string;
  mobile: string;
  statusLabel?: string;
  qrToken?: string | null;
};

export default function InvitesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");

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

  async function invite(sendWhatsApp: boolean) {
    if (!selectedIds.length) {
      setMsg("حدد مستفيدين أولاً");
      return;
    }
    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ beneficiaryIds: selectedIds, sendWhatsApp }),
    });
    const json = await res.json();
    setMsg(res.ok ? `تمت دعوة ${json.invited} مستفيد` : json.error);
    if (res.ok) {
      setSelected({});
      load();
    }
  }

  return (
    <div className="space-y-4">
      <div className="panel">
        <h1 className="text-2xl font-extrabold text-primary mb-3">الدعوات الجماعية</h1>
        <div className="flex gap-2 flex-wrap mb-3">
          <input className="input-field max-w-md" value={q} onChange={(e) => setQ(e.target.value)} placeholder="تصفية" />
          <button className="btn-secondary" type="button" onClick={load}>
            تحديث
          </button>
          <button className="btn-primary" type="button" onClick={() => invite(false)}>
            دعوة المحددين
          </button>
          <button className="btn-recommend" type="button" onClick={() => invite(true)}>
            دعوة + واتساب (stub)
          </button>
        </div>
        {msg ? <p className="text-sm font-semibold text-primary mb-3">{msg}</p> : null}
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
                  <td>{r.statusLabel}</td>
                  <td>
                    {r.qrToken ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/qr/${r.qrToken}`} alt="QR" width={56} height={56} />
                    ) : (
                      "—"
                    )}
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

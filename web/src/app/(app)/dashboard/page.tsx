"use client";

import { useEffect, useState } from "react";

type DashboardData = {
  exhibition: { name: string; location?: string | null };
  stats: {
    totalBeneficiaries: number;
    invited: number;
    attended: number;
    received: number;
    remainingToReceive: number;
    piecesDispensed: number;
    exceptions: number;
    completionRate: number;
  };
  inventory: Array<{ id: string; attributes: Record<string, unknown>; quantity: number; lowStock: boolean }>;
  topItems: Array<{ inventoryItemId: string; quantity: number; attributes: Record<string, unknown> }>;
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const res = await fetch("/api/dashboard");
      const json = await res.json();
      if (!alive) return;
      if (!res.ok) {
        setError(json.error || "تعذر التحميل");
        return;
      }
      setData(json);
    };
    load();
    const t = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (error) return <div className="panel text-[var(--tmkeen-danger)]">{error}</div>;
  if (!data) return <div className="panel">جاري تحميل لوحة التحكم...</div>;

  const tiles = [
    { label: "إجمالي المستفيدين", value: data.stats.totalBeneficiaries },
    { label: "المدعوون", value: data.stats.invited },
    { label: "الحاضرون", value: data.stats.attended },
    { label: "استلموا", value: data.stats.received },
    { label: "متبقون للاستلام", value: data.stats.remainingToReceive },
    { label: "القطع المصروفة", value: data.stats.piecesDispensed },
    { label: "حالات استثنائية", value: data.stats.exceptions },
    { label: "نسبة الإنجاز %", value: data.stats.completionRate },
  ];

  return (
    <div className="space-y-4">
      <div className="panel">
        <h1 className="text-2xl font-extrabold text-primary">{data.exhibition.name}</h1>
        <p className="mt-1 text-sm">{data.exhibition.location || "—"}</p>
      </div>
      <div className="stat-grid">
        {tiles.map((t) => (
          <div key={t.label} className="stat-tile">
            <div className="value">{t.value}</div>
            <div className="label">{t.label}</div>
          </div>
        ))}
      </div>
      <div className="panel">
        <h2 className="font-bold text-primary mb-3">الكميات المتبقية</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>الصنف</th>
                <th>الكمية</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {data.inventory.map((i) => (
                <tr key={i.id}>
                  <td>{JSON.stringify(i.attributes)}</td>
                  <td>{i.quantity}</td>
                  <td>
                    <span className={`badge ${i.lowStock ? "badge-warning" : "badge-success"}`}>
                      {i.lowStock ? "قرب النفاد" : "متوفر"}
                    </span>
                  </td>
                </tr>
              ))}
              {!data.inventory.length ? (
                <tr>
                  <td colSpan={3}>لا توجد أصناف بعد</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
      <div className="panel">
        <h2 className="font-bold text-primary mb-3">الأصناف الأكثر صرفاً</h2>
        <ul className="space-y-2">
          {data.topItems.map((t) => (
            <li key={t.inventoryItemId} className="flex justify-between gap-3 border-b border-surface-border pb-2">
              <span>{JSON.stringify(t.attributes)}</span>
              <strong>{t.quantity}</strong>
            </li>
          ))}
          {!data.topItems.length ? <li>لا بيانات بعد</li> : null}
        </ul>
      </div>
    </div>
  );
}

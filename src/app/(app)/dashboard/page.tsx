"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { AttrChips } from "@/components/AttrChips";

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

  if (error) {
    return (
      <div className="page-stack">
        <PageHeader title="لوحة التحكم" />
        <p className="msg msg-error">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page-stack">
        <PageHeader title="لوحة التحكم" />
        <div className="panel empty">جاري تحميل لوحة التحكم...</div>
      </div>
    );
  }

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
    <div className="page-stack">
      <PageHeader
        title={data.exhibition.name}
        description={data.exhibition.location || "لوحة متابعة لحظية أثناء تشغيل المعرض"}
      />

      <div className="stat-grid">
        {tiles.map((t) => (
          <div key={t.label} className="stat-tile">
            <div className="value">{t.value}</div>
            <div className="label">{t.label}</div>
          </div>
        ))}
      </div>

      <div className="split-2">
        <section className="panel">
          <h2 className="panel-title">الكميات المتبقية</h2>
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
                    <td>
                      <AttrChips attributes={i.attributes} />
                    </td>
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
                    <td colSpan={3} className="empty">
                      لا توجد أصناف بعد
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <h2 className="panel-title">الأصناف الأكثر صرفاً</h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.75rem" }}>
            {data.topItems.map((t) => (
              <li
                key={t.inventoryItemId}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "1rem",
                  alignItems: "center",
                  paddingBottom: "0.75rem",
                  borderBottom: "1px solid var(--tmkeen-surface-border)",
                }}
              >
                <AttrChips attributes={t.attributes} />
                <strong style={{ color: "var(--tmkeen-primary)" }}>{t.quantity}</strong>
              </li>
            ))}
            {!data.topItems.length ? <li className="empty">لا بيانات بعد</li> : null}
          </ul>
        </section>
      </div>
    </div>
  );
}

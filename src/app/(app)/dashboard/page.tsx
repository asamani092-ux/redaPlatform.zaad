"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { AttrChips } from "@/components/AttrChips";
import { KpiCard } from "@/components/ui/KpiCard";
import { Progress } from "@/components/ui/Progress";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

type DashboardData = {
  exhibition: { name: string; location?: string | null };
  stats: {
    totalBeneficiaries: number;
    beneficiaryFamilies?: number;
    totalIndividuals?: number;
    invited: number;
    attended: number;
    received: number;
    remainingToReceive: number;
    piecesDispensed: number;
    exceptions: number;
    overrideDispenses?: number;
    completionRate: number;
    inventoryRemaining?: number;
    platformContributed?: number;
    platformDispensed?: number;
    platformRemaining?: number;
    storeContributed?: number;
    storeDispensed?: number;
    storeRemaining?: number;
    volunteers?: number;
  };
  attributeLabels?: Record<string, string>;
  inventory: Array<{
    id: string;
    skuCode?: string;
    attributes: Record<string, unknown>;
    quantity: number;
    lowStock: boolean;
  }>;
  topItems: Array<{ inventoryItemId: string; quantity: number; attributes: Record<string, unknown> }>;
  storeSummary?: Array<{
    storeName: string;
    skuCode: string;
    attributes: Record<string, unknown>;
    added: number;
    dispensed: number;
    remaining: number;
  }>;
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
        <PageHeader
          title="لوحة التحكم"
          breadcrumb={[{ label: "الرئيسية", href: "/dashboard" }, { label: "لوحة التحكم" }]}
        />
        <EmptyState title="تعذر التحميل" body={error} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page-stack">
        <PageHeader title="لوحة التحكم" />
        <div className="panel">
          <Skeleton lines={5} height="2.5rem" />
        </div>
      </div>
    );
  }

  const families =
    data.stats.beneficiaryFamilies ?? data.stats.totalBeneficiaries;
  const individuals = data.stats.totalIndividuals ?? data.stats.totalBeneficiaries;
  const tiles = [
    { label: "إجمالي الأسر", value: families },
    { label: "إجمالي المستفيدين", value: individuals },
    { label: "المدعوون", value: data.stats.invited },
    { label: "المتطوعون", value: data.stats.volunteers ?? 0 },
    { label: "الحاضرون", value: data.stats.attended },
    { label: "استلموا", value: data.stats.received },
    { label: "متبقون للاستلام", value: data.stats.remainingToReceive },
    { label: "القطع المصروفة (إجمالي)", value: data.stats.piecesDispensed },
    { label: "متبقي المخزون (إجمالي)", value: data.stats.inventoryRemaining ?? 0 },
    { label: "مضاف من المنصة", value: data.stats.platformContributed ?? 0 },
    { label: "مصروف من المنصة", value: data.stats.platformDispensed ?? 0 },
    { label: "متبقي للمنصة", value: data.stats.platformRemaining ?? 0 },
    { label: "مساهمات المتاجر", value: data.stats.storeContributed ?? 0 },
    { label: "مصروف من المتاجر", value: data.stats.storeDispensed ?? 0 },
    { label: "متبقي للمتاجر", value: data.stats.storeRemaining ?? 0 },
    { label: "حضور استثنائي", value: data.stats.exceptions },
    { label: "صرف استثنائي", value: data.stats.overrideDispenses ?? 0 },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        title={data.exhibition.name}
        description={data.exhibition.location || "لوحة متابعة لحظية أثناء تشغيل المعرض"}
        breadcrumb={[{ label: "الرئيسية", href: "/dashboard" }, { label: "لوحة التحكم" }]}
      />

      <div className="zad-card" style={{ marginBottom: "var(--space-4)" }}>
        <Progress
          value={data.stats.completionRate}
          label={`نسبة الاستلام من الحضور: ${data.stats.completionRate}%`}
        />
      </div>

      <div className="stat-grid">
        {tiles.map((t) => (
          <KpiCard key={t.label} label={t.label} value={t.value} />
        ))}
      </div>

      <div className="split-2">
        <section className="panel zad-card">
          <h2 className="panel-title">الكميات المتبقية</h2>
          <div className="table-wrap table-wrap--stack zad-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>الرمز</th>
                  <th>الصنف</th>
                  <th>الكمية</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {data.inventory.map((i) => (
                  <tr key={i.id}>
                    <td data-label="الرمز" dir="ltr">
                      {i.skuCode ?? "—"}
                    </td>
                    <td data-label="الصنف">
                      <AttrChips attributes={i.attributes} labels={data.attributeLabels} />
                    </td>
                    <td data-label="الكمية">{i.quantity}</td>
                    <td data-label="الحالة">
                      <span className={`zad-badge ${i.lowStock ? "zad-badge--warning" : "zad-badge--success"}`}>
                        {i.lowStock ? "قرب النفاد" : "متوفر"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.inventory.length ? (
            <EmptyState title="لا توجد أصناف بعد" body="أضف أصناف المخزون من شاشة المخزون." />
          ) : null}
        </section>

        <section className="panel zad-card">
          <h2 className="panel-title">أعلى 5 قطع مصروفة</h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "var(--space-3)" }}>
            {data.topItems.map((t) => (
              <li
                key={t.inventoryItemId}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "var(--space-4)",
                  alignItems: "center",
                  paddingBottom: "var(--space-3)",
                  borderBottom: "var(--border-hairline) solid var(--border-subtle)",
                }}
              >
                <AttrChips attributes={t.attributes} labels={data.attributeLabels} />
                <strong style={{ color: "var(--text-brand)", flexShrink: 0 }}>{t.quantity}</strong>
              </li>
            ))}
          </ul>
          {!data.topItems.length ? <EmptyState title="لا بيانات صرف بعد" /> : null}
        </section>
      </div>
    </div>
  );
}

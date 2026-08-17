"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { AttrChips } from "@/components/AttrChips";
import { KpiCard } from "@/components/ui/KpiCard";
import { Progress } from "@/components/ui/Progress";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

type Sponsor = { id: string; name: string; logoUrl: string };

type DashboardData = {
  exhibition: { name: string; location?: string | null };
  stats: {
    totalBeneficiaries: number;
    beneficiaryFamilies?: number;
    totalIndividuals?: number;
    attendedFamilies?: number;
    attendedIndividuals?: number;
    invited: number;
    attended: number;
    received: number;
    remainingToReceive: number;
    piecesDispensed: number;
    clothesPiecesDispensed?: number;
    fabricMetersDispensed?: number;
    associationCount?: number;
    associationAttendedFamilies?: number;
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
  };
  sponsors?: Sponsor[];
  attributeLabels?: Record<string, string>;
  inventory: Array<{
    id: string;
    skuCode?: string;
    attributes: Record<string, unknown>;
    quantity: number;
    lowStock: boolean;
  }>;
  topItems: Array<{ inventoryItemId: string; quantity: number; attributes: Record<string, unknown> }>;
};

function Section({
  title,
  tiles,
}: {
  title: string;
  tiles: Array<{ label: string; value: number | string }>;
}) {
  return (
    <section className="panel dashboard-section">
      <h2 className="panel-title">{title}</h2>
      <div className="stat-grid">
        {tiles.map((t) => (
          <KpiCard key={t.label} label={t.label} value={t.value} />
        ))}
      </div>
    </section>
  );
}

/** شريط شعارات الداعمين — تمرير أفقي مستمر. Time: O(n) للعرض. */
function SponsorsMarquee({ sponsors }: { sponsors: Sponsor[] }) {
  if (!sponsors.length) {
    return (
      <section className="panel sponsors-band">
        <h2 className="panel-title">الداعمين</h2>
        <EmptyState title="لا داعمين بعد" body="أضف شعارات الداعمين من الإعدادات." />
      </section>
    );
  }
  const loop = [...sponsors, ...sponsors];
  return (
    <section className="panel sponsors-band">
      <h2 className="panel-title">الداعمين</h2>
      <div className="sponsors-marquee" aria-label="شعارات الداعمين">
        <div className="sponsors-marquee__track">
          {loop.map((s, idx) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${s.id}-${idx}`}
              src={s.logoUrl}
              alt={s.name}
              title={s.name}
              className="sponsors-marquee__logo"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

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
    void load();
    const t = setInterval(() => void load(), 15000);
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

  const s = data.stats;
  const secondary = [
    { label: "المدعوون", value: s.invited },
    { label: "استلموا", value: s.received },
    { label: "متبقون للاستلام", value: s.remainingToReceive },
    { label: "القطع المصروفة (إجمالي)", value: s.piecesDispensed },
    { label: "متبقي المخزون (إجمالي)", value: s.inventoryRemaining ?? 0 },
    { label: "مصروف من المنصة", value: s.platformDispensed ?? 0 },
    { label: "مصروف من المتاجر", value: s.storeDispensed ?? 0 },
    { label: "حضور استثنائي", value: s.exceptions },
    { label: "صرف استثنائي", value: s.overrideDispenses ?? 0 },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        title={data.exhibition.name}
        description={data.exhibition.location || "لوحة متابعة لحظية أثناء تشغيل المعرض"}
        breadcrumb={[{ label: "الرئيسية", href: "/dashboard" }, { label: "لوحة التحكم" }]}
      />

      <div className="zad-card dashboard-progress">
        <Progress
          value={s.completionRate}
          label={`نسبة الاستلام من الحضور: ${s.completionRate}%`}
        />
      </div>

      <Section
        title="الحضور"
        tiles={[
          { label: "الأسر", value: s.attendedFamilies ?? s.attended },
          { label: "الأفراد", value: s.attendedIndividuals ?? s.totalIndividuals ?? 0 },
        ]}
      />

      <Section
        title="المصروف"
        tiles={[
          { label: "الملابس (قطع)", value: s.clothesPiecesDispensed ?? 0 },
          { label: "الأقمشة (أمتار)", value: s.fabricMetersDispensed ?? 0 },
        ]}
      />

      <Section
        title="الشراكات"
        tiles={[
          { label: "الجمعيات الشريكة", value: s.associationCount ?? 0 },
          {
            label: "الأسر المستفيدة من الجمعيات",
            value: s.associationAttendedFamilies ?? 0,
          },
        ]}
      />

      <details className="panel dashboard-secondary">
        <summary className="panel-title">مؤشرات تشغيلية إضافية</summary>
        <div className="stat-grid" style={{ marginTop: "0.75rem" }}>
          {secondary.map((t) => (
            <KpiCard key={t.label} label={t.label} value={t.value} />
          ))}
        </div>
        <div className="split-2" style={{ marginTop: "1rem" }}>
          <section>
            <h3 className="panel-title">الكميات المتبقية</h3>
            <div className="table-wrap zad-table-wrap">
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
                        <span
                          className={`zad-badge ${i.lowStock ? "zad-badge--warning" : "zad-badge--success"}`}
                        >
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
          <section>
            <h3 className="panel-title">أعلى 5 قطع مصروفة</h3>
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "grid",
                gap: "var(--space-3)",
              }}
            >
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
      </details>

      <SponsorsMarquee sponsors={data.sponsors ?? []} />
    </div>
  );
}

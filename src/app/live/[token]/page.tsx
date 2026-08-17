"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AttrChips } from "@/components/AttrChips";
import { KpiCard } from "@/components/ui/KpiCard";
import { Progress } from "@/components/ui/Progress";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ShareRow } from "@/lib/report-metrics";

type Sponsor = { id: string; name: string; logoUrl: string };

type LivePayload = {
  exhibition: { id: string; name: string; location: string | null; active: boolean };
  updatedAt: string;
  stats: {
    totalBeneficiaries: number;
    invited: number;
    attended: number;
    received: number;
    remainingToReceive: number;
    piecesDispensed: number;
    exceptions: number;
    completionRate: number;
    beneficiaryFamilies: number;
    totalIndividuals: number;
    attendedFamilies?: number;
    attendedIndividuals?: number;
    clothesPiecesDispensed?: number;
    fabricMetersDispensed?: number;
    associationCount?: number;
    associationAttendedFamilies?: number;
  };
  sponsors?: Sponsor[];
  byAssociationShares: ShareRow[];
  byNeighborhoodShares: ShareRow[];
  byHouseholdSizeShares: ShareRow[];
  topItems: Array<{
    inventoryItemId: string;
    quantity: number;
    attributes: Record<string, unknown>;
  }>;
  attributeLabels?: Record<string, string>;
};

/** شعارات الداعمين — صف أفقي ثابت. Time: O(n). */
function SponsorsRow({ sponsors }: { sponsors: Sponsor[] }) {
  if (!sponsors.length) {
    return (
      <section className="live-screen__sponsors">
        <h2 className="live-screen__section-title">الداعمين</h2>
        <EmptyState title="لا داعمين بعد" />
      </section>
    );
  }
  return (
    <section className="live-screen__sponsors">
      <h2 className="live-screen__section-title">الداعمين</h2>
      <div
        className="sponsors-grid"
        dir="ltr"
        aria-label="شعارات الداعمين"
        style={{
          display: "flex",
          flexDirection: "row",
          flexWrap: "nowrap",
          justifyContent: "center",
          alignItems: "center",
          gap: "2rem",
          width: "100%",
          overflowX: "auto",
          overflowY: "hidden",
        }}
      >
        {sponsors.map((s) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={s.id}
            src={s.logoUrl}
            alt={s.name}
            title={s.name}
            className="sponsors-grid__logo"
            style={{
              display: "block",
              height: "72px",
              width: "auto",
              maxWidth: "200px",
              objectFit: "contain",
              flex: "0 0 auto",
            }}
          />
        ))}
      </div>
    </section>
  );
}

function KpiSection({
  title,
  tiles,
}: {
  title: string;
  tiles: Array<{ label: string; value: number | string }>;
}) {
  return (
    <section className="live-screen__kpi-section dashboard-section">
      <h2 className="live-screen__section-title">{title}</h2>
      <div className="live-screen__stats live-screen__stats--pair">
        {tiles.map((t) => (
          <KpiCard key={t.label} label={t.label} value={t.value} />
        ))}
      </div>
    </section>
  );
}

export default function LiveDisplayPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";
  const [data, setData] = useState<LivePayload | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`/api/live/${encodeURIComponent(token)}`, {
      cache: "no-store",
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "تعذر التحميل");
      setData(null);
      return;
    }
    setError("");
    setData(json);
  }, [token]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 12000);
    return () => clearInterval(t);
  }, [load]);

  if (error) {
    return (
      <main className="live-screen zad-root">
        <EmptyState title="تعذر التحميل" body={error} />
      </main>
    );
  }

  if (!data) {
    return (
      <main className="live-screen zad-root">
        <Skeleton lines={6} height="3rem" />
      </main>
    );
  }

  const { stats } = data;

  return (
    <main className="live-screen zad-root">
      <header className="live-screen__header">
        <div>
          <p className="live-screen__brand">منصة رداء</p>
          <h1 className="live-screen__title">{data.exhibition.name}</h1>
          {data.exhibition.location ? (
            <p className="live-screen__sub">{data.exhibition.location}</p>
          ) : null}
        </div>
        <div className="live-screen__meta">
          <Progress value={stats.completionRate} label={`نسبة الإنجاز ${stats.completionRate}%`} />
          <div className="live-screen__sub" style={{ marginTop: "var(--space-2)" }}>
            تحديث: {new Date(data.updatedAt).toLocaleTimeString("ar-SA")}
          </div>
        </div>
      </header>

      <KpiSection
        title="الحضور"
        tiles={[
          { label: "الأسر", value: stats.attendedFamilies ?? stats.attended },
          {
            label: "الأفراد",
            value: stats.attendedIndividuals ?? stats.totalIndividuals,
          },
        ]}
      />

      <KpiSection
        title="المصروف"
        tiles={[
          { label: "الملابس (قطع)", value: stats.clothesPiecesDispensed ?? 0 },
          { label: "الأقمشة (أمتار)", value: stats.fabricMetersDispensed ?? 0 },
        ]}
      />

      <KpiSection
        title="الشراكات"
        tiles={[
          { label: "الجمعيات الشريكة", value: stats.associationCount ?? 0 },
          {
            label: "الأسر المستفيدة من الجمعيات",
            value: stats.associationAttendedFamilies ?? 0,
          },
        ]}
      />

      <SponsorsRow sponsors={data.sponsors ?? []} />

      <details className="live-screen__more">
        <summary>تفاصيل إضافية</summary>
        <section className="live-screen__stats">
          {[
            ["المدعوون", stats.invited],
            ["الحاضرون", stats.attended],
            ["استلموا", stats.received],
            ["متبقٍ للاستلام", stats.remainingToReceive],
            ["القطع المصروفة (إجمالي)", stats.piecesDispensed],
            ["حضور استثنائي", stats.exceptions],
          ].map(([label, value]) => (
            <KpiCard key={String(label)} label={String(label)} value={value as number | string} />
          ))}
        </section>

        <section className="live-screen__grid">
          <SharePanel title="نسب الجمعيات" rows={data.byAssociationShares} />
          <SharePanel title="نسب الأحياء" rows={data.byNeighborhoodShares} />
          <SharePanel title="توزيع الأسر حسب عدد الأفراد" rows={data.byHouseholdSizeShares} />
          <div className="live-screen__panel">
            <h2>أعلى 5 قطع مصروفة</h2>
            <ul>
              {data.topItems.map((t, i) => (
                <li key={t.inventoryItemId}>
                  <div className="live-screen__row">
                    <span>#{i + 1}</span>
                    <strong>{t.quantity}</strong>
                  </div>
                  <AttrChips attributes={t.attributes} labels={data.attributeLabels} />
                </li>
              ))}
              {!data.topItems.length ? (
                <li>
                  <EmptyState title="لا بيانات بعد" />
                </li>
              ) : null}
            </ul>
          </div>
        </section>
      </details>
    </main>
  );
}

function SharePanel({ title, rows }: { title: string; rows: ShareRow[] }) {
  return (
    <div className="live-screen__panel">
      <h2>{title}</h2>
      <ul>
        {rows.slice(0, 8).map((r) => (
          <li key={r.key}>
            <div className="live-screen__row">
              <span>{r.key}</span>
              <strong>
                {r.count} ({r.percent}%)
              </strong>
            </div>
            <div className="live-screen__bar" aria-hidden>
              <span style={{ width: `${Math.min(100, r.percent)}%` }} />
            </div>
          </li>
        ))}
        {!rows.length ? (
          <li>
            <EmptyState title="لا بيانات" />
          </li>
        ) : null}
      </ul>
    </div>
  );
}

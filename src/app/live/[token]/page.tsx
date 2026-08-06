"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AttrChips } from "@/components/AttrChips";
import { KpiCard } from "@/components/ui/KpiCard";
import { Progress } from "@/components/ui/Progress";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ShareRow } from "@/lib/report-metrics";

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
    avgHouseholdSize: number;
  };
  byAssociationShares: ShareRow[];
  byNeighborhoodShares: ShareRow[];
  byHouseholdSizeShares: ShareRow[];
  topItems: Array<{
    inventoryItemId: string;
    quantity: number;
    attributes: Record<string, unknown>;
  }>;
};

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

      <section className="live-screen__stats">
        {[
          ["الأسر المستفيدة", stats.beneficiaryFamilies],
          ["متوسط حجم الأسرة", stats.avgHouseholdSize],
          ["المدعوون", stats.invited],
          ["الحاضرون", stats.attended],
          ["استلموا", stats.received],
          ["متبقٍ للاستلام", stats.remainingToReceive],
          ["القطع المصروفة", stats.piecesDispensed],
          ["حضور استثنائي", stats.exceptions],
        ].map(([label, value]) => (
          <KpiCard key={String(label)} label={String(label)} value={value as number | string} />
        ))}
      </section>

      <section className="live-screen__grid">
        <SharePanel title="نسب الجمعيات" rows={data.byAssociationShares} />
        <SharePanel title="نسب الأحياء" rows={data.byNeighborhoodShares} />
        <SharePanel title="توزيع حجم الأسر" rows={data.byHouseholdSizeShares} />
        <div className="live-screen__panel">
          <h2>أعلى 5 قطع مصروفة</h2>
          <ul>
            {data.topItems.map((t, i) => (
              <li key={t.inventoryItemId}>
                <div className="live-screen__row">
                  <span>#{i + 1}</span>
                  <strong>{t.quantity}</strong>
                </div>
                <AttrChips attributes={t.attributes} />
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

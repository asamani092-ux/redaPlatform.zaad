"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AttrChips } from "@/components/AttrChips";
import { Progress } from "@/components/ui/Progress";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { KpiSections } from "@/components/ui/KpiSections";
import { exhibitionKpisToSections } from "@/lib/exhibition-kpi-labels";
import type { ExhibitionKpiSections } from "@/lib/exhibition-kpis";

type LivePayload = {
  exhibition: { id: string; name: string; location: string | null; active: boolean };
  updatedAt: string;
  stats: {
    completionRate: number;
  };
  exhibitionKpis: ExhibitionKpiSections;
  topItems: Array<{
    inventoryItemId: string;
    quantity: number;
    attributes: Record<string, unknown>;
  }>;
  attributeLabels?: Record<string, string>;
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
          <Progress value={data.stats.completionRate} label={`نسبة الإنجاز ${data.stats.completionRate}%`} />
          <div className="live-screen__sub" style={{ marginTop: "var(--space-2)" }}>
            تحديث: {new Date(data.updatedAt).toLocaleTimeString("ar-SA")}
          </div>
        </div>
      </header>

      <KpiSections sections={exhibitionKpisToSections(data.exhibitionKpis)} />

      <section className="live-screen__grid" style={{ marginTop: "var(--space-4)" }}>
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
    </main>
  );
}

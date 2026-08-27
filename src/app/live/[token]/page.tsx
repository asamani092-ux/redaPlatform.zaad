"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { KpiCard } from "@/components/ui/KpiCard";
import { Progress } from "@/components/ui/Progress";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { exhibitionKpisToLiveTiles } from "@/lib/exhibition-kpi-labels";
import type { ExhibitionKpiSections } from "@/lib/exhibition-kpis";

type LivePayload = {
  exhibition: { id: string; name: string; location: string | null; active: boolean };
  updatedAt: string;
  stats: {
    completionRate: number;
  };
  exhibitionKpis: ExhibitionKpiSections;
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
    const raw = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      setError("تعذر تحميل البيانات — أعد تشغيل الخادم أو راجع السجلات");
      setData(null);
      return;
    }
    if (!res.ok) {
      setError(String(json.error || "تعذر التحميل"));
      setData(null);
      return;
    }
    setError("");
    setData(json as unknown as LivePayload);
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

  const tiles = exhibitionKpisToLiveTiles(data.exhibitionKpis);

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

      <section className="live-screen__stats">
        {tiles.map((tile) => (
          <KpiCard key={tile.label} className="live-kpi-card" label={tile.label} value={tile.value} />
        ))}
      </section>
    </main>
  );
}

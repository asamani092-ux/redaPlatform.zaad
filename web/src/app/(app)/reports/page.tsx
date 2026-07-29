"use client";

import { useEffect, useState } from "react";

type Summary = {
  totalBeneficiaries: number;
  invited: number;
  attended: number;
  received: number;
  piecesDispensed: number;
  byGender: Record<string, number>;
  byCity: Record<string, number>;
  byNeighborhood: Record<string, number>;
};

export default function ReportsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/reports?format=json")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "فشل");
        setSummary(j.summary);
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="space-y-4">
      <div className="panel">
        <h1 className="text-2xl font-extrabold text-primary mb-3">التقارير والإحصاءات</h1>
        <div className="flex gap-2 flex-wrap">
          <a className="btn-primary" href="/api/reports?format=xlsx">
            تصدير Excel
          </a>
          <a className="btn-secondary" href="/api/reports?format=pdf" target="_blank" rel="noreferrer">
            تصدير PDF (طباعة)
          </a>
        </div>
        {error ? <p className="mt-3 text-[var(--tmkeen-danger)]">{error}</p> : null}
      </div>
      {summary ? (
        <>
          <div className="stat-grid">
            {[
              ["المستفيدون", summary.totalBeneficiaries],
              ["المدعوون", summary.invited],
              ["الحضور", summary.attended],
              ["المستلمون", summary.received],
              ["القطع", summary.piecesDispensed],
            ].map(([label, value]) => (
              <div key={String(label)} className="stat-tile">
                <div className="value">{value as number}</div>
                <div className="label">{label as string}</div>
              </div>
            ))}
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <Breakdown title="حسب الجنس" data={summary.byGender} />
            <Breakdown title="حسب المدينة" data={summary.byCity} />
            <Breakdown title="حسب الحي" data={summary.byNeighborhood} />
          </div>
        </>
      ) : (
        <div className="panel">جاري التحميل...</div>
      )}
    </div>
  );
}

function Breakdown({ title, data }: { title: string; data: Record<string, number> }) {
  return (
    <div className="panel">
      <h2 className="font-bold text-primary mb-2">{title}</h2>
      <ul className="space-y-1">
        {Object.entries(data).map(([k, v]) => (
          <li key={k} className="flex justify-between gap-2 border-b border-surface-border pb-1">
            <span>{k}</span>
            <strong>{v}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

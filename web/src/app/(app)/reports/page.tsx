"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";

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
    <div className="page-stack">
      <PageHeader
        title="التقارير والإحصاءات"
        description="ملخصات قابلة للتصدير مع تقسيم الصفحات عند الحجم الكبير"
        actions={
          <>
            <a className="btn-primary" href="/api/reports?format=xlsx">
              تصدير Excel
            </a>
            <a className="btn-secondary" href="/api/reports?format=pdf" target="_blank" rel="noreferrer">
              تصدير PDF
            </a>
          </>
        }
      />
      {error ? <p className="msg msg-error">{error}</p> : null}

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
          <div className="split-2" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
            <Breakdown title="حسب الجنس" data={summary.byGender} />
            <Breakdown title="حسب المدينة" data={summary.byCity} />
            <Breakdown title="حسب الحي" data={summary.byNeighborhood} />
          </div>
        </>
      ) : (
        <div className="panel empty">جاري التحميل...</div>
      )}
    </div>
  );
}

function Breakdown({ title, data }: { title: string; data: Record<string, number> }) {
  return (
    <section className="panel">
      <h2 className="panel-title">{title}</h2>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.55rem" }}>
        {Object.entries(data).map(([k, v]) => (
          <li
            key={k}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "0.75rem",
              paddingBottom: "0.45rem",
              borderBottom: "1px solid var(--tmkeen-surface-border)",
            }}
          >
            <span>{k}</span>
            <strong style={{ color: "var(--tmkeen-primary)" }}>{v}</strong>
          </li>
        ))}
        {!Object.keys(data).length ? <li className="empty">لا بيانات</li> : null}
      </ul>
    </section>
  );
}

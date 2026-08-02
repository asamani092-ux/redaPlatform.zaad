"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/PageHeader";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";

type Summary = {
  exhibitionId: string;
  exhibitionName: string;
  exhibitionActive: boolean;
  totalBeneficiaries: number;
  invited: number;
  attended: number;
  received: number;
  exceptionAttendance?: number;
  overrideDispenses?: number;
  piecesDispensed: number;
  byGender: Record<string, number>;
  byCity: Record<string, number>;
  byNeighborhood: Record<string, number>;
  byFamilySize?: Record<string, number>;
};

type ExhibitionOpt = { id: string; name: string; active: boolean };

export default function ReportsPage() {
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const canPickExhibition = role
    ? hasPermission(role, "exhibitions:manage") || role === "ADMIN"
    : false;

  const [summary, setSummary] = useState<Summary | null>(null);
  const [exhibitions, setExhibitions] = useState<ExhibitionOpt[]>([]);
  const [exhibitionId, setExhibitionId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async (id?: string) => {
    setError("");
    const qs = new URLSearchParams({ format: "json" });
    if (id) qs.set("exhibitionId", id);
    const res = await fetch(`/api/reports?${qs}`);
    const j = await res.json();
    if (!res.ok) {
      setSummary(null);
      setError(j.error || "فشل التحميل");
      return;
    }
    setSummary(j.summary);
    if (!id && j.summary?.exhibitionId) setExhibitionId(j.summary.exhibitionId);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!canPickExhibition) return;
    fetch("/api/exhibitions")
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j.data)) setExhibitions(j.data);
      })
      .catch(() => undefined);
  }, [canPickExhibition]);

  const exportQs = exhibitionId ? `&exhibitionId=${encodeURIComponent(exhibitionId)}` : "";

  return (
    <div className="page-stack">
      <PageHeader
        title="التقارير والإحصاءات"
        description="ملخصات قابلة للتصدير — التشغيل يبقى على المعرض النشط"
        actions={
          <>
            <a className="btn-primary" href={`/api/reports?format=xlsx${exportQs}`}>
              تصدير Excel
            </a>
            <a
              className="btn-secondary"
              href={`/api/reports?format=pdf${exportQs}`}
              target="_blank"
              rel="noreferrer"
            >
              تصدير PDF
            </a>
          </>
        }
      />
      {error ? <p className="msg msg-error">{error}</p> : null}

      {canPickExhibition ? (
        <section className="panel">
          <h2 className="panel-title">عرض تقارير معرض</h2>
          <div className="toolbar">
            <select
              className="input-field"
              value={exhibitionId}
              onChange={(e) => {
                const id = e.target.value;
                setExhibitionId(id);
                void load(id);
              }}
            >
              {exhibitions.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name} — {ex.active ? "نشط" : "غير نشط"}
                </option>
              ))}
            </select>
          </div>
          {summary ? (
            <p className="page-header__desc" style={{ marginTop: "0.75rem" }}>
              المعروض: {summary.exhibitionName}
              {summary.exhibitionActive ? " (التشغيل الحالي)" : ""}
            </p>
          ) : null}
        </section>
      ) : null}

      {summary ? (
        <>
          <div className="stat-grid">
            {[
              ["إجمالي المستفيدين", summary.totalBeneficiaries],
              ["المدعوون", summary.invited],
              ["الحاضرون", summary.attended],
              ["استلموا", summary.received],
              ["القطع المصروفة", summary.piecesDispensed],
              ["حضور استثنائي", summary.exceptionAttendance ?? 0],
              ["صرف استثنائي", summary.overrideDispenses ?? 0],
            ].map(([label, value]) => (
              <div key={String(label)} className="stat-tile">
                <div className="value">{value as number}</div>
                <div className="label">{label as string}</div>
              </div>
            ))}
          </div>
          <div className="split-2">
            <Breakdown title="حسب الجنس" data={summary.byGender} />
            <Breakdown title="حسب المدينة" data={summary.byCity} />
            <Breakdown title="حسب الحي" data={summary.byNeighborhood} />
            <Breakdown title="حسب حجم الأسرة (عدد التابعين)" data={summary.byFamilySize ?? {}} />
          </div>
        </>
      ) : (
        !error && <div className="panel empty">جاري التحميل...</div>
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

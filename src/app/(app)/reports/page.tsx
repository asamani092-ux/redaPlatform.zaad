"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/PageHeader";
import { AttrChips } from "@/components/AttrChips";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";
import type { ShareRow } from "@/lib/report-metrics";

type TopItem = {
  inventoryItemId: string;
  quantity: number;
  attributes: Record<string, unknown>;
};

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
  beneficiaryFamilies?: number;
  avgHouseholdSize?: number;
  byGender: Record<string, number>;
  byCity: Record<string, number>;
  byNeighborhood: Record<string, number>;
  byFamilySize?: Record<string, number>;
  byAssociation?: Record<string, number>;
  byGenderShares?: ShareRow[];
  byCityShares?: ShareRow[];
  byNeighborhoodShares?: ShareRow[];
  byAssociationShares?: ShareRow[];
  byHouseholdSizeShares?: ShareRow[];
  topItems?: TopItem[];
};

type ExhibitionOpt = { id: string; name: string; active: boolean };

type LiveLink = {
  id: string;
  token: string;
  label: string | null;
  createdAt: string;
  url: string;
};

export default function ReportsPage() {
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const canPickExhibition = role
    ? hasPermission(role, "exhibitions:manage") || role === "ADMIN"
    : false;
  const canManageLive =
    !!role &&
    (hasPermission(role, "exhibitions:manage") ||
      hasPermission(role, "reports:view") ||
      role === "ADMIN");

  const [summary, setSummary] = useState<Summary | null>(null);
  const [exhibitions, setExhibitions] = useState<ExhibitionOpt[]>([]);
  const [exhibitionId, setExhibitionId] = useState("");
  const [error, setError] = useState("");
  const [liveLinks, setLiveLinks] = useState<LiveLink[]>([]);
  const [liveMsg, setLiveMsg] = useState("");
  const [liveBusy, setLiveBusy] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const toast = useToast();

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

  const loadLiveLinks = useCallback(async (exId: string) => {
    if (!exId || !canManageLive) return;
    const res = await fetch(`/api/live-links?exhibitionId=${encodeURIComponent(exId)}`);
    const j = await res.json();
    if (res.ok) setLiveLinks(j.data ?? []);
  }, [canManageLive]);

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

  useEffect(() => {
    if (exhibitionId) void loadLiveLinks(exhibitionId);
  }, [exhibitionId, loadLiveLinks]);

  const exportQs = exhibitionId ? `&exhibitionId=${encodeURIComponent(exhibitionId)}` : "";

  async function createLiveLink() {
    if (!exhibitionId || liveBusy) return;
    setLiveBusy(true);
    setLiveMsg("");
    const res = await fetch("/api/live-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exhibitionId,
        label: newLabel.trim() || undefined,
      }),
    });
    const j = await res.json();
    setLiveBusy(false);
    if (!res.ok) {
      setLiveMsg(j.error || "فشل إنشاء الرابط");
      return;
    }
    setNewLabel("");
    setLiveMsg("تم إنشاء رابط العرض الحي");
    toast.push({ title: "تم إنشاء رابط العرض الحي", tone: "success" });
    await loadLiveLinks(exhibitionId);
  }

  async function deleteLiveLink(id: string) {
    if (liveBusy) return;
    if (!window.confirm("حذف رابط العرض الحي؟ سيتوقف فوراً.")) return;
    setLiveBusy(true);
    setLiveMsg("");
    const res = await fetch(`/api/live-links?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const j = await res.json().catch(() => ({}));
    setLiveBusy(false);
    if (!res.ok) {
      setLiveMsg(j.error || "فشل الحذف");
      return;
    }
    setLiveMsg("تم حذف الرابط");
    await loadLiveLinks(exhibitionId);
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setLiveMsg("تم نسخ الرابط");
    } catch {
      setLiveMsg(url);
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="التقارير والإحصاءات"
        description="ملخصات قابلة للتصدير — التشغيل يبقى على المعرض النشط"
        breadcrumb={[{ label: "الرئيسية", href: "/dashboard" }, { label: "التقارير" }]}
        actions={
          <>
            <a className="btn-primary" href={`/api/reports?format=xlsx${exportQs}`}>
              تصدير Excel
            </a>
            <a
              className="btn-recommend"
              href={`/api/reports?format=presentation&html=1${exportQs}`}
              target="_blank"
              rel="noreferrer"
            >
              منشئ العرض التقديمي
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
              ["الأسر المستفيدة", summary.beneficiaryFamilies ?? summary.totalBeneficiaries],
              ["متوسط حجم الأسرة", summary.avgHouseholdSize ?? "—"],
              ["المدعوون", summary.invited],
              ["الحاضرون", summary.attended],
              ["استلموا", summary.received],
              ["القطع المصروفة", summary.piecesDispensed],
              ["حضور استثنائي", summary.exceptionAttendance ?? 0],
              ["صرف استثنائي", summary.overrideDispenses ?? 0],
            ].map(([label, value]) => (
              <KpiCard key={String(label)} label={String(label)} value={value as number | string} />
            ))}
          </div>

          <div className="split-2">
            <ShareBreakdown
              title="نسب التوزيع حسب الجمعية"
              rows={summary.byAssociationShares}
              fallback={summary.byAssociation}
            />
            <ShareBreakdown
              title="مؤشر الأسر — توزيع حجم الأسرة"
              rows={summary.byHouseholdSizeShares}
              fallback={summary.byFamilySize}
              footer={
                <p className="page-header__desc" style={{ marginTop: "0.75rem" }}>
                  عدد الأسر: {summary.beneficiaryFamilies ?? summary.totalBeneficiaries}
                  {" — "}
                  المتوسط: {summary.avgHouseholdSize ?? "—"} (المستفيد + التابعون)
                </p>
              }
            />
            <ShareBreakdown
              title="نسب التوزيع حسب الحي"
              rows={summary.byNeighborhoodShares}
              fallback={summary.byNeighborhood}
            />
            <ShareBreakdown
              title="حسب الجنس"
              rows={summary.byGenderShares}
              fallback={summary.byGender}
            />
            <ShareBreakdown
              title="حسب المدينة"
              rows={summary.byCityShares}
              fallback={summary.byCity}
            />
            <section className="panel">
              <h2 className="panel-title">أعلى 5 قطع مصروفة</h2>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.65rem" }}>
                {(summary.topItems ?? []).map((t, idx) => (
                  <li
                    key={t.inventoryItemId}
                    style={{
                      display: "grid",
                      gap: "0.35rem",
                      paddingBottom: "0.55rem",
                      borderBottom: "1px solid var(--tmkeen-surface-border)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
                      <strong>#{idx + 1}</strong>
                      <strong style={{ color: "var(--tmkeen-primary)" }}>{t.quantity}</strong>
                    </div>
                    <AttrChips attributes={t.attributes} />
                  </li>
                ))}
                {!(summary.topItems ?? []).length ? <li className="empty">لا بيانات بعد</li> : null}
              </ul>
            </section>
          </div>

          {canManageLive && exhibitionId ? (
            <section className="panel">
              <h2 className="panel-title">روابط العرض الحي للشاشات</h2>
              <p className="page-header__desc">
                رابط فريد بلا تسجيل دخول — مناسب للشاشات ومتابعة المدير. احذف الرابط لإيقافه فوراً.
              </p>
              {liveMsg ? <p className="msg">{liveMsg}</p> : null}
              <div className="toolbar" style={{ marginTop: "0.75rem" }}>
                <input
                  className="input-field"
                  placeholder="وصف اختياري (مثلاً شاشة الاستقبال)"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-primary"
                  disabled={liveBusy}
                  onClick={() => void createLiveLink()}
                >
                  إنشاء رابط
                </button>
              </div>
              <div className="table-wrap table-wrap--stack" style={{ marginTop: "1rem" }}>
                <table>
                  <thead>
                    <tr>
                      <th>الوصف</th>
                      <th>الرابط</th>
                      <th>تاريخ الإنشاء</th>
                      <th>إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveLinks.map((l) => (
                      <tr key={l.id}>
                        <td data-label="الوصف">{l.label || "—"}</td>
                        <td data-label="الرابط" dir="ltr" style={{ fontSize: "0.8rem", wordBreak: "break-all" }}>
                          {l.url}
                        </td>
                        <td data-label="تاريخ الإنشاء">
                          {new Date(l.createdAt).toLocaleString("ar-SA")}
                        </td>
                        <td data-label="إجراءات">
                          <div className="row-actions">
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => void copyUrl(l.url)}
                            >
                              نسخ
                            </button>
                            <a
                              className="btn-secondary"
                              href={l.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              فتح
                            </a>
                            <button
                              type="button"
                              className="btn-danger"
                              disabled={liveBusy}
                              onClick={() => void deleteLiveLink(l.id)}
                            >
                              حذف
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!liveLinks.length ? (
                      <tr>
                        <td colSpan={4} className="empty">
                          لا روابط بعد — أنشئ رابطاً للإرسال للمدير أو العرض على الشاشة
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </>
      ) : error ? (
        <EmptyState title="تعذر تحميل التقرير" body={error} />
      ) : (
        <div className="panel">
          <Skeleton lines={6} height="2.5rem" />
        </div>
      )}
    </div>
  );
}

function ShareBreakdown({
  title,
  rows,
  fallback,
  footer,
}: {
  title: string;
  rows?: ShareRow[];
  fallback?: Record<string, number>;
  footer?: ReactNode;
}) {
  const list: ShareRow[] =
    rows ??
    Object.entries(fallback ?? {}).map(([key, count]) => ({
      key,
      count,
      percent: 0,
    }));
  const total = list.reduce((s, r) => s + r.count, 0);

  return (
    <section className="panel">
      <h2 className="panel-title">{title}</h2>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.55rem" }}>
        {list.map((r) => {
          const pct =
            r.percent || (total > 0 ? Math.round((r.count / total) * 1000) / 10 : 0);
          return (
            <li key={r.key} style={{ display: "grid", gap: "0.25rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                }}
              >
                <span>{r.key}</span>
                <strong style={{ color: "var(--tmkeen-primary)" }}>
                  {r.count} ({pct}%)
                </strong>
              </div>
              <div
                aria-hidden
                style={{
                  height: 6,
                  borderRadius: 999,
                  background: "var(--tmkeen-surface-border)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, pct)}%`,
                    height: "100%",
                    background: "var(--tmkeen-primary)",
                  }}
                />
              </div>
            </li>
          );
        })}
        {!list.length ? <li className="empty">لا بيانات</li> : null}
      </ul>
      {footer}
    </section>
  );
}

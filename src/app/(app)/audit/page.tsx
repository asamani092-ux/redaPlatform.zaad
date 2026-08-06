"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { PaginationBar } from "@/components/PaginationBar";
import { DataTable } from "@/components/ui/DataTable";
import { actionLabel, entityLabel } from "@/lib/audit-labels";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

type Log = {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  createdAt: string;
  status?: string | null;
  statusLabel?: string | null;
  statusReason?: string | null;
  user?: { name: string; mobile: string } | null;
};

function statusBadgeClass(status?: string | null): string {
  if (status === "FAILED") return "badge badge-danger";
  if (status === "PARTIAL") return "badge badge-warning";
  return "badge badge-success";
}

export default function AuditPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async (p: number) => {
    setBusy(true);
    const res = await fetch(`/api/audit?page=${p}&pageSize=${DEFAULT_PAGE_SIZE}`);
    const json = await res.json();
    setBusy(false);
    setLoaded(true);
    if (!res.ok) return;
    setLogs(json.data ?? []);
    setPage(json.page ?? p);
    setTotalPages(json.totalPages ?? 1);
    setTotal(json.total ?? 0);
  }, []);

  useEffect(() => {
    void load(1);
  }, [load]);

  return (
    <div className="page-stack">
      <PageHeader
        title="سجل العمليات"
        description="تتبع تراكمي لكل التعديلات والحركات — 50 عملية لكل صفحة"
        breadcrumb={[{ label: "الرئيسية", href: "/dashboard" }, { label: "سجل العمليات" }]}
        actions={
          <a className="btn-secondary" href="/api/audit?format=pdf" target="_blank" rel="noreferrer">
            طباعة PDF
          </a>
        }
      />
      <section className="panel">
        <DataTable
          loading={!loaded && busy}
          empty={loaded && !logs.length}
          emptyTitle="لا سجلات بعد"
          emptyBody="ستظهر هنا العمليات التراكمية عند بدء الاستخدام."
          className="table-wrap--stack"
        >
          <table>
            <thead>
              <tr>
                <th scope="col">الوقت</th>
                <th scope="col">المستخدم</th>
                <th scope="col">الإجراء</th>
                <th scope="col">الكيان</th>
                <th scope="col">الحالة</th>
                <th scope="col">المعرف</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td data-label="الوقت">{new Date(l.createdAt).toLocaleString("ar-SA")}</td>
                  <td data-label="المستخدم">{l.user?.name ?? "—"}</td>
                  <td data-label="الإجراء">{actionLabel(l.action)}</td>
                  <td data-label="الكيان">{entityLabel(l.entityType)}</td>
                  <td data-label="الحالة">
                    <span className={statusBadgeClass(l.status)} title={l.statusReason ?? undefined}>
                      {l.statusLabel ?? "نجاح"}
                    </span>
                    {l.statusReason ? (
                      <div className="page-header__desc" style={{ marginTop: "var(--space-1)" }}>
                        {l.statusReason}
                      </div>
                    ) : null}
                  </td>
                  <td data-label="المعرف" dir="ltr" className="page-header__desc">
                    {l.entityId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
        <PaginationBar
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={DEFAULT_PAGE_SIZE}
          busy={busy}
          onPageChange={(p) => void load(p)}
        />
      </section>
    </div>
  );
}

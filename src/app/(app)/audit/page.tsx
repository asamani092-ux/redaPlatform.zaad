"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { actionLabel, entityLabel } from "@/lib/audit-labels";

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

  useEffect(() => {
    fetch("/api/audit")
      .then((r) => r.json())
      .then((j) => setLogs(j.data ?? []));
  }, []);

  return (
    <div className="page-stack">
      <PageHeader
        title="سجل العمليات"
        description="تتبع تراكمي لكل التعديلات والحركات"
        actions={
          <a className="btn-secondary" href="/api/audit?format=pdf" target="_blank" rel="noreferrer">
            طباعة PDF
          </a>
        }
      />
      <section className="panel">
        <div className="table-wrap table-wrap--stack">
          <table>
            <thead>
              <tr>
                <th>الوقت</th>
                <th>المستخدم</th>
                <th>الإجراء</th>
                <th>الكيان</th>
                <th>الحالة</th>
                <th>المعرف</th>
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
                      <div style={{ fontSize: "0.78rem", marginTop: "0.25rem", opacity: 0.85 }}>
                        {l.statusReason}
                      </div>
                    ) : null}
                  </td>
                  <td data-label="المعرف" dir="ltr" style={{ fontSize: "0.78rem" }}>
                    {l.entityId}
                  </td>
                </tr>
              ))}
              {!logs.length ? (
                <tr>
                  <td colSpan={6} className="empty">
                    لا سجلات بعد
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

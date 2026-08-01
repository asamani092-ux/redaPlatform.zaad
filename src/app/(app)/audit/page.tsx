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
  user?: { name: string; mobile: string } | null;
};

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
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>الوقت</th>
                <th>المستخدم</th>
                <th>الإجراء</th>
                <th>الكيان</th>
                <th>المعرف</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td>{new Date(l.createdAt).toLocaleString("ar-SA")}</td>
                  <td>{l.user?.name ?? "—"}</td>
                  <td>{actionLabel(l.action)}</td>
                  <td>{entityLabel(l.entityType)}</td>
                  <td dir="ltr" style={{ fontSize: "0.78rem" }}>
                    {l.entityId}
                  </td>
                </tr>
              ))}
              {!logs.length ? (
                <tr>
                  <td colSpan={5} className="empty">
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

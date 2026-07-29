"use client";

import { useEffect, useState } from "react";

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
    <div className="panel">
      <h1 className="text-2xl font-extrabold text-primary mb-3">سجل العمليات</h1>
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
                <td>{l.action}</td>
                <td>{l.entityType}</td>
                <td dir="ltr" className="text-xs">
                  {l.entityId}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { actionLabel, entityLabel } from "@/lib/audit-labels";
import { auditStatusLabel, resolveAuditStatus } from "@/lib/audit-status";
import { buildPrintDocument, escapeHtml } from "@/lib/print-html";
import { parsePageParams, paginatedPayload } from "@/lib/pagination";

function enrichLog<T extends { metaJson: unknown }>(l: T) {
  const meta =
    l.metaJson && typeof l.metaJson === "object" && !Array.isArray(l.metaJson)
      ? (l.metaJson as Record<string, unknown>)
      : null;
  const { status, statusReason } = resolveAuditStatus(meta);
  return {
    ...l,
    status: status ?? "SUCCESS",
    statusReason,
    statusLabel: auditStatusLabel(status ?? "SUCCESS"),
  };
}

export async function GET(req: NextRequest) {
  const authz = await requirePermission("audit:view");
  if ("error" in authz) return authz.error;

  const format = req.nextUrl.searchParams.get("format") ?? "json";

  if (format === "pdf") {
    const logs = await prisma.auditLog.findMany({
      include: { user: { select: { name: true, mobile: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    const enriched = logs.map(enrichLog);
    const rowsHtml = enriched
      .map(
        (l) => `<tr>
          <td class="ltr">${escapeHtml(new Date(l.createdAt).toLocaleString("ar-SA"))}</td>
          <td>${escapeHtml(l.user?.name ?? "—")}</td>
          <td>${escapeHtml(actionLabel(l.action))}</td>
          <td>${escapeHtml(entityLabel(l.entityType))}</td>
          <td>${escapeHtml(l.statusLabel)}${l.statusReason ? ` — ${escapeHtml(l.statusReason)}` : ""}</td>
          <td class="ltr">${escapeHtml(l.entityId ?? "")}</td>
        </tr>`,
      )
      .join("");

    const html = buildPrintDocument({
      title: "سجل العمليات",
      subtitle: `آخر ${enriched.length} عملية — تتبع تراكمي لكل التعديلات والحركات`,
      sectionsHtml: `
        <table>
          <thead>
            <tr><th>الوقت</th><th>المستخدم</th><th>الإجراء</th><th>الكيان</th><th>الحالة</th><th>المعرف</th></tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>`,
    });
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const { page, pageSize, skip, take } = parsePageParams(req.nextUrl.searchParams);
  const [total, logs] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.findMany({
      include: { user: { select: { name: true, mobile: true, role: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
  ]);

  return NextResponse.json(paginatedPayload(logs.map(enrichLog), page, pageSize, total));
}

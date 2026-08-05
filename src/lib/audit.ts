import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { AuditStatus } from "@/lib/audit-status";

/** تسجيل تراكمي — O(1) لكل عملية */
export async function writeAuditLog(input: {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  meta?: unknown;
  /** تُدمج في metaJson لعرض الحالة في سجل العمليات */
  status?: AuditStatus;
  statusReason?: string | null;
}) {
  const baseMeta: Record<string, unknown> = {};
  if (input.meta && typeof input.meta === "object" && !Array.isArray(input.meta)) {
    Object.assign(baseMeta, input.meta as Record<string, unknown>);
  } else if (input.meta != null) {
    baseMeta.value = input.meta;
  }
  if (input.status) baseMeta.status = input.status;
  if (input.statusReason) baseMeta.statusReason = input.statusReason;

  await prisma.auditLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      beforeJson: (input.before as Prisma.InputJsonValue) ?? undefined,
      afterJson: (input.after as Prisma.InputJsonValue) ?? undefined,
      metaJson: Object.keys(baseMeta).length
        ? (baseMeta as Prisma.InputJsonValue)
        : undefined,
    },
  });
}

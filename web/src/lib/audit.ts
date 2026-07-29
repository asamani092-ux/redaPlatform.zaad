import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

/** تسجيل تراكمي — O(1) لكل عملية */
export async function writeAuditLog(input: {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  meta?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      beforeJson: (input.before as Prisma.InputJsonValue) ?? undefined,
      afterJson: (input.after as Prisma.InputJsonValue) ?? undefined,
      metaJson: (input.meta as Prisma.InputJsonValue) ?? undefined,
    },
  });
}

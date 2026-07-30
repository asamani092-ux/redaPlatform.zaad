import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";

export async function PATCH(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const authz = await requirePermission("exhibitions:manage");
  if ("error" in authz) return authz.error;
  const { id } = await ctx.params;

  const target = await prisma.exhibition.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "المعرض غير موجود" }, { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.exhibition.updateMany({ data: { active: false } });
    return tx.exhibition.update({
      where: { id },
      data: { active: true },
      include: { settings: true },
    });
  });

  await writeAuditLog({
    userId: authz.userId,
    action: "EXHIBITION_ACTIVATE",
    entityType: "Exhibition",
    entityId: id,
    after: { id: updated.id, name: updated.name, active: true },
  });

  return NextResponse.json({ data: updated });
}

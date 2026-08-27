import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";

/**
 * حذف معرض — مدير النظام فقط. يُمنع حذف المعرض النشط تشغيلياً.
 * Time: O(1) + تكلفة CASCADE.
 */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const authz = await requireAdmin();
  if ("error" in authz) return authz.error;

  const { id } = await ctx.params;
  const before = await prisma.exhibition.findUnique({
    where: { id },
    include: { settings: true },
  });
  if (!before) {
    return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  }
  if (before.active) {
    return NextResponse.json(
      { error: "لا يمكن حذف المعرض النشط — فعّل معرضاً آخر أولاً" },
      { status: 409 },
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.outboundMessage.updateMany({
        where: { exhibitionId: id },
        data: { exhibitionId: null },
      });
      await tx.exhibition.delete({ where: { id } });
    });
  } catch (e) {
    console.error("exhibition DELETE failed:", e);
    return NextResponse.json({ error: "فشل حذف المعرض" }, { status: 500 });
  }

  await writeAuditLog({
    userId: authz.userId,
    action: "EXHIBITION_DELETE",
    entityType: "Exhibition",
    entityId: id,
    before,
  });

  return NextResponse.json({ ok: true });
}

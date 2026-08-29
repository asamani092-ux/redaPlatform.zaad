import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { PasswordResetRequestStatus } from "@/generated/prisma/enums";

/** قائمة طلبات الاستعادة المعلّقة للمدير — O(n) على عدد الطلبات النشطة */
export async function GET() {
  const authz = await requirePermission("users:manage");
  if ("error" in authz) return authz.error;

  const now = new Date();
  const rows = await prisma.passwordResetRequest.findMany({
    where: {
      status: PasswordResetRequestStatus.PENDING,
      expiresAt: { gt: now },
    },
    include: {
      user: { select: { id: true, name: true, mobile: true, role: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  return NextResponse.json({
    data: rows.map((r) => ({
      id: r.id,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
      expiresInSec: Math.max(0, Math.floor((r.expiresAt.getTime() - Date.now()) / 1000)),
      user: r.user,
    })),
  });
}

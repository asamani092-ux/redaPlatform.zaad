import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";

export async function GET() {
  const authz = await requirePermission("audit:view");
  if ("error" in authz) return authz.error;

  const logs = await prisma.auditLog.findMany({
    include: { user: { select: { name: true, mobile: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ data: logs });
}

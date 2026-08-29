import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PasswordResetRequestStatus } from "@/generated/prisma/enums";

/**
 * حالة طلب الاستعادة للموظف (polling) — O(1).
 * لا يكشف اسم المستخدم أو الجوال.
 */
export async function GET(req: NextRequest) {
  const requestId = req.nextUrl.searchParams.get("requestId")?.trim() ?? "";
  if (!requestId || requestId.startsWith("pending_")) {
    return NextResponse.json({
      status: requestId.startsWith("pending_") ? "PENDING" : "EXPIRED",
      expiresAt: null,
    });
  }

  const row = await prisma.passwordResetRequest.findUnique({
    where: { id: requestId },
    select: { status: true, expiresAt: true, usedAt: true },
  });
  if (!row) {
    return NextResponse.json({ status: "EXPIRED", expiresAt: null });
  }

  const expired = row.expiresAt.getTime() <= Date.now();
  if (row.status === PasswordResetRequestStatus.USED || row.usedAt) {
    return NextResponse.json({
      status: "USED",
      expiresAt: row.expiresAt.toISOString(),
    });
  }
  if (expired || row.status === PasswordResetRequestStatus.CANCELLED) {
    return NextResponse.json({
      status: "EXPIRED",
      expiresAt: row.expiresAt.toISOString(),
    });
  }
  if (row.status === PasswordResetRequestStatus.APPROVED) {
    return NextResponse.json({
      status: "APPROVED",
      expiresAt: row.expiresAt.toISOString(),
    });
  }
  return NextResponse.json({
    status: "PENDING",
    expiresAt: row.expiresAt.toISOString(),
  });
}

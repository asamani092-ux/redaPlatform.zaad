import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";
import { PasswordResetRequestStatus } from "@/generated/prisma/enums";

const schema = z.object({
  requestId: z.string().min(8),
});

/** موافقة المدير على طلب استعادة — لا تمدد المدة. O(1) */
export async function POST(req: NextRequest) {
  const authz = await requirePermission("users:manage");
  if ("error" in authz) return authz.error;

  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "حدد الطلب" }, { status: 400 });
  }

  const reset = await prisma.passwordResetRequest.findUnique({
    where: { id: body.data.requestId },
    include: { user: { select: { id: true, name: true, mobile: true } } },
  });
  if (!reset) {
    return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
  }
  if (reset.expiresAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: "انتهت مدة الطلب (5 دقائق)" }, { status: 400 });
  }
  if (reset.status !== PasswordResetRequestStatus.PENDING) {
    return NextResponse.json({ error: "الطلب ليس بانتظار الموافقة" }, { status: 400 });
  }

  const updated = await prisma.passwordResetRequest.update({
    where: { id: reset.id },
    data: {
      status: PasswordResetRequestStatus.APPROVED,
      approvedAt: new Date(),
      approvedById: authz.userId,
    },
  });

  await writeAuditLog({
    userId: authz.userId,
    action: "PASSWORD_RESET_APPROVE",
    entityType: "PasswordResetRequest",
    entityId: reset.id,
    meta: {
      targetUserId: reset.userId,
      targetMobile: reset.user.mobile,
      expiresAt: reset.expiresAt.toISOString(),
    },
  });

  return NextResponse.json({
    ok: true,
    id: updated.id,
    status: updated.status,
    expiresAt: updated.expiresAt.toISOString(),
  });
}

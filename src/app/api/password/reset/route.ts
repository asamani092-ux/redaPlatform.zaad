import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { PasswordResetRequestStatus } from "@/generated/prisma/enums";

const schema = z.object({
  requestId: z.string().min(8),
  password: z.string().min(8, "كلمة المرور 8 أحرف على الأقل"),
});

/** تعيين كلمة مرور بعد موافقة المدير — O(1) */
export async function POST(req: NextRequest) {
  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json(
      { error: body.error.issues[0]?.message ?? "بيانات غير صالحة" },
      { status: 400 },
    );
  }

  if (body.data.requestId.startsWith("pending_")) {
    return NextResponse.json({ error: "الطلب غير صالح أو منتهٍ" }, { status: 400 });
  }

  const reset = await prisma.passwordResetRequest.findUnique({
    where: { id: body.data.requestId },
  });
  if (
    !reset ||
    reset.status !== PasswordResetRequestStatus.APPROVED ||
    reset.expiresAt.getTime() <= Date.now() ||
    reset.usedAt
  ) {
    return NextResponse.json(
      { error: "الطلب غير موافق عليه أو منتهٍ — اطلب مجدداً" },
      { status: 400 },
    );
  }

  const hash = await bcrypt.hash(body.data.password, 10);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: reset.userId },
      data: { passwordHash: hash, active: true },
    }),
    prisma.passwordResetRequest.update({
      where: { id: reset.id },
      data: { status: PasswordResetRequestStatus.USED, usedAt: new Date() },
    }),
  ]);

  await writeAuditLog({
    userId: reset.userId,
    action: "PASSWORD_RESET",
    entityType: "User",
    entityId: reset.userId,
    meta: {
      via: "admin-approved-request",
      requestId: reset.id,
      approvedById: reset.approvedById,
    },
  });

  return NextResponse.json({ ok: true, message: "تم تغيير كلمة المرور — سجّل الدخول الآن" });
}

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  mobile: z.string().min(9),
  code: z.string().min(4),
  password: z.string().min(8, "كلمة المرور 8 أحرف على الأقل"),
});

/** تأكيد رمز الاستعادة وتعيين كلمة مرور جديدة — O(1) */
export async function POST(req: NextRequest) {
  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json(
      { error: body.error.issues[0]?.message ?? "بيانات غير صالحة" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { mobile: body.data.mobile.trim() },
  });
  if (!user || !user.active) {
    return NextResponse.json({ error: "رمز غير صحيح أو منتهي" }, { status: 400 });
  }

  const reset = await prisma.passwordReset.findFirst({
    where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!reset || !(await bcrypt.compare(body.data.code.trim(), reset.codeHash))) {
    return NextResponse.json({ error: "رمز غير صحيح أو منتهي" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(body.data.password, 10) },
    }),
    prisma.passwordReset.update({
      where: { id: reset.id },
      data: { usedAt: new Date() },
    }),
  ]);

  await writeAuditLog({
    userId: user.id,
    action: "PASSWORD_RESET",
    entityType: "User",
    entityId: user.id,
    meta: { via: "whatsapp-otp" },
  });

  return NextResponse.json({ ok: true, message: "تم تغيير كلمة المرور — سجّل الدخول الآن" });
}

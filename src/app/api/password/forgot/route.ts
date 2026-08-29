import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isValidSaudiMobile, MOBILE_ERROR, normalizeMobile } from "@/lib/mobile";
import { PasswordResetRequestStatus } from "@/generated/prisma/enums";

const schema = z.object({ mobile: z.string().min(9) });

const TTL_MS = 5 * 60_000;
const RATE_LIMIT_MS = 60_000;

const GENERIC_MSG =
  "إن كان الجوال مسجلاً فسيظهر طلب للمدير — بلّغه خلال 5 دقائق ثم عيّن كلمة المرور بعد الموافقة";

/**
 * طلب استعادة كلمة المرور — موافقة مدير لاحقاً، بدون OTP واتساب.
 * رد عام + requestId دائماً. Time O(1).
 */
export async function POST(req: NextRequest) {
  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "أدخل رقم الجوال" }, { status: 400 });
  }

  const mobile = normalizeMobile(body.data.mobile);
  if (!isValidSaudiMobile(mobile)) {
    return NextResponse.json({ error: MOBILE_ERROR }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { mobile } });
  if (!user || !user.active) {
    return NextResponse.json({
      ok: true,
      message: GENERIC_MSG,
      requestId: `pending_${randomUUID().replace(/-/g, "")}`,
      expiresInSec: 300,
    });
  }

  const recent = await prisma.passwordResetRequest.findFirst({
    where: {
      userId: user.id,
      createdAt: { gt: new Date(Date.now() - RATE_LIMIT_MS) },
      status: { in: [PasswordResetRequestStatus.PENDING, PasswordResetRequestStatus.APPROVED] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (recent && recent.expiresAt > new Date()) {
    return NextResponse.json({
      ok: true,
      message: GENERIC_MSG,
      requestId: recent.id,
      expiresInSec: Math.max(0, Math.floor((recent.expiresAt.getTime() - Date.now()) / 1000)),
    });
  }

  // إلغاء الطلبات السابقة النشطة لنفس المستخدم — تراكمي بلا حذف
  await prisma.passwordResetRequest.updateMany({
    where: {
      userId: user.id,
      status: { in: [PasswordResetRequestStatus.PENDING, PasswordResetRequestStatus.APPROVED] },
    },
    data: { status: PasswordResetRequestStatus.CANCELLED },
  });

  const created = await prisma.passwordResetRequest.create({
    data: {
      userId: user.id,
      status: PasswordResetRequestStatus.PENDING,
      expiresAt: new Date(Date.now() + TTL_MS),
    },
  });

  return NextResponse.json({
    ok: true,
    message: GENERIC_MSG,
    requestId: created.id,
    expiresInSec: 300,
  });
}

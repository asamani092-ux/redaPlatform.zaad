import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { OutboundMessageType } from "@/generated/prisma/enums";
import { getWhatsAppConfig } from "@/lib/whatsapp-config";

const schema = z.object({ mobile: z.string().min(9) });

/**
 * طلب رمز استعادة كلمة المرور — يُرسل عبر واتساب وينتهي خلال 10 دقائق.
 * الرد عام دائماً لمنع تعداد الحسابات. في الوضع التجريبي يُعاد الرمز لفتح شاشة التغيير مباشرة.
 * O(1) استعلامات.
 */
export async function POST(req: NextRequest) {
  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "أدخل رقم الجوال" }, { status: 400 });
  }

  const generic = {
    ok: true,
    message: "إن كان الجوال مسجلاً فسيصلك رمز تحقق عبر واتساب خلال دقائق",
    openReset: true as const,
  };

  const user = await prisma.user.findUnique({
    where: { mobile: body.data.mobile.trim() },
  });
  if (!user || !user.active) return NextResponse.json(generic);

  // منع الإغراق: رمز واحد كل 60 ثانية
  const recent = await prisma.passwordReset.findFirst({
    where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 60_000) } },
  });
  if (recent) return NextResponse.json(generic);

  const code = String(randomInt(100000, 1000000));
  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      codeHash: await bcrypt.hash(code, 10),
      expiresAt: new Date(Date.now() + 10 * 60_000),
    },
  });

  await sendWhatsAppMessage({
    mobile: user.mobile,
    body: `رمز استعادة كلمة المرور لمنصة رداء: ${code} — صالح 10 دقائق. تجاهل الرسالة إن لم تطلبها.`,
    type: OutboundMessageType.OTP,
  });

  const wa = await getWhatsAppConfig();
  if (wa.provider === "stub") {
    return NextResponse.json({
      ...generic,
      message: "تم فتح تعديل كلمة المرور — أدخل الرمز التجريبي الظاهر ثم كلمة المرور الجديدة",
      trialCode: code,
    });
  }

  return NextResponse.json(generic);
}

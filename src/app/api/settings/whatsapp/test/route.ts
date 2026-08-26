import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { getWhatsAppConfig } from "@/lib/whatsapp-config";
import { OutboundMessageType, OutboundMessageStatus } from "@/generated/prisma/enums";

const schema = z.object({ mobile: z.string().min(9) });

/** اختبار إرسال رسالة واتساب بالإعداد الحالي — O(1) */
export async function POST(req: NextRequest) {
  const authz = await requirePermission("settings:manage");
  if ("error" in authz) return authz.error;

  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "أدخل رقم جوال للاختبار" }, { status: 400 });
  }

  const config = await getWhatsAppConfig();
  const isZad = config.provider === "zad";
  const msg = await sendWhatsAppMessage({
    mobile: body.data.mobile.trim(),
    body: "رسالة اختبار من منصة معرض رداء — الإعداد يعمل بنجاح.",
    type: isZad ? OutboundMessageType.THANK_YOU : OutboundMessageType.TEST,
    createdById: authz.userId,
    ...(isZad
      ? { templateParams: ["اختبار", "منصة رداء"] as string[] }
      : {}),
  });

  const failed = msg.status === OutboundMessageStatus.FAILED;
  const statusReason = failed
    ? msg.errorMessage ?? "خطأ غير معروف"
    : msg.status === OutboundMessageStatus.STUBBED
      ? "وضع تجريبي (stub)"
      : null;

  await writeAuditLog({
    userId: authz.userId,
    action: "WHATSAPP_TEST",
    entityType: "AppConfig",
    entityId: "app",
    meta: {
      mobile: body.data.mobile.trim(),
      provider: config.provider,
      messageStatus: msg.status,
    },
    status: failed ? "FAILED" : "SUCCESS",
    statusReason,
  });

  if (failed) {
    return NextResponse.json(
      {
        error: `فشل الإرسال: ${msg.errorMessage ?? "خطأ غير معروف"}`,
        status: msg.status,
        statusReason,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    status: msg.status,
    message:
      msg.status === OutboundMessageStatus.STUBBED
        ? "الوضع تجريبي (stub) — سُجلت الرسالة داخلياً دون إرسال حقيقي"
        : "تم إرسال رسالة الاختبار بنجاح",
  });
}

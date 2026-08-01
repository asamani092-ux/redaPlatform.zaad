import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";
import { getWhatsAppConfig, maskToken } from "@/lib/whatsapp-config";

const putSchema = z.object({
  provider: z.enum(["stub", "api"]),
  apiUrl: z.string().optional().nullable(),
  /** فارغ = الإبقاء على التوكن المحفوظ */
  apiToken: z.string().optional().nullable(),
  sender: z.string().optional().nullable(),
});

export async function GET() {
  const authz = await requirePermission("settings:manage");
  if ("error" in authz) return authz.error;

  const config = await getWhatsAppConfig();
  return NextResponse.json({
    provider: config.provider === "stub" ? "stub" : "api",
    apiUrl: config.apiUrl ?? "",
    tokenMask: maskToken(config.apiToken),
    hasToken: !!config.apiToken,
    sender: config.sender ?? "",
    source: config.source,
  });
}

export async function PUT(req: NextRequest) {
  const authz = await requirePermission("settings:manage");
  if ("error" in authz) return authz.error;

  const body = putSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const current = await prisma.appConfig.findUnique({ where: { id: "app" } });

  if (body.data.provider === "api") {
    const url = body.data.apiUrl?.trim();
    const token = body.data.apiToken?.trim() || current?.whatsappApiToken;
    if (!url) {
      return NextResponse.json({ error: "رابط الإرسال (API URL) مطلوب للوضع الفعلي" }, { status: 400 });
    }
    if (!token) {
      return NextResponse.json({ error: "التوكن مطلوب للوضع الفعلي" }, { status: 400 });
    }
  }

  const data = {
    whatsappProvider: body.data.provider,
    whatsappApiUrl: body.data.apiUrl?.trim() || null,
    // التوكن الفارغ يعني الإبقاء على المحفوظ — لا استبدال بالحذف (إضافة تراكمية)
    whatsappApiToken: body.data.apiToken?.trim()
      ? body.data.apiToken.trim()
      : (current?.whatsappApiToken ?? null),
    whatsappSender: body.data.sender?.trim() || null,
  };

  const saved = await prisma.appConfig.upsert({
    where: { id: "app" },
    update: data,
    create: { id: "app", ...data },
  });

  await writeAuditLog({
    userId: authz.userId,
    action: "WHATSAPP_SETTINGS_UPDATE",
    entityType: "AppConfig",
    entityId: "app",
    before: current
      ? {
          provider: current.whatsappProvider,
          apiUrl: current.whatsappApiUrl,
          token: maskToken(current.whatsappApiToken),
          sender: current.whatsappSender,
        }
      : null,
    after: {
      provider: saved.whatsappProvider,
      apiUrl: saved.whatsappApiUrl,
      token: maskToken(saved.whatsappApiToken),
      sender: saved.whatsappSender,
    },
  });

  return NextResponse.json({
    ok: true,
    provider: saved.whatsappProvider,
    apiUrl: saved.whatsappApiUrl ?? "",
    tokenMask: maskToken(saved.whatsappApiToken),
    hasToken: !!saved.whatsappApiToken,
    sender: saved.whatsappSender ?? "",
  });
}

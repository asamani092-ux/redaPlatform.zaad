import { prisma } from "@/lib/prisma";

/**
 * إعداد واتساب: قاعدة البيانات أولاً (قابل للتعديل من الواجهة)،
 * ومتغيرات البيئة كقيمة افتراضية للتوافق الخلفي — O(1) لكل قراءة.
 */
export type WhatsAppConfig = {
  provider: string;
  apiUrl: string | null;
  apiToken: string | null;
  sender: string | null;
  source: "database" | "env";
};

export async function getWhatsAppConfig(): Promise<WhatsAppConfig> {
  const row = await prisma.appConfig.findUnique({ where: { id: "app" } });
  if (row) {
    return {
      provider: row.whatsappProvider || "stub",
      apiUrl: row.whatsappApiUrl,
      apiToken: row.whatsappApiToken,
      sender: row.whatsappSender,
      source: "database",
    };
  }
  return {
    provider: process.env.WHATSAPP_PROVIDER ?? "stub",
    apiUrl: process.env.WHATSAPP_API_URL ?? null,
    apiToken: process.env.WHATSAPP_API_TOKEN ?? null,
    sender: null,
    source: "env",
  };
}

/** إخفاء التوكن: أول 4 وآخر 4 فقط — O(1) */
export function maskToken(token: string | null | undefined): string {
  if (!token) return "";
  if (token.length <= 8) return "••••";
  return `${token.slice(0, 4)}••••${token.slice(-4)}`;
}

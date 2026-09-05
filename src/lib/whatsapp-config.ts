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
  inviteTemplateId: string | null;
  /** قالب الرسالة الثانية: نص + صورة الباركود */
  inviteQrTemplateId: string | null;
  /** صورة هيدر الدعوة (بوستر) إن كان الهيدر ديناميكياً — وإلا البوستر ثابت في القالب */
  inviteHeaderImageUrl: string | null;
  thanksTemplateId: string | null;
  surveyTemplateId: string | null;
  /** صورة هيدر الاستبيان — إن خلاها يُستخدم بوستر الدعوة */
  surveyHeaderImageUrl: string | null;
};

/** كاش طلب قصير لتفادي N قراءات AppConfig في البث الجماعي */
let cached: { at: number; value: WhatsAppConfig } | null = null;
const CACHE_MS = 5_000;

const ZAD_DEFAULT_URL =
  "https://wawebhook.icsl.me/whatsapp-automation/wa/send-template";

function envTemplates() {
  return {
    inviteTemplateId: process.env.WHATSAPP_INVITE_TEMPLATE_ID?.trim() || null,
    inviteQrTemplateId:
      process.env.WHATSAPP_INVITE_QR_TEMPLATE_ID?.trim() || null,
    inviteHeaderImageUrl:
      process.env.WHATSAPP_INVITE_HEADER_IMAGE_URL?.trim() || null,
    thanksTemplateId: process.env.WHATSAPP_THANKS_TEMPLATE_ID?.trim() || null,
    surveyTemplateId: process.env.WHATSAPP_SURVEY_TEMPLATE_ID?.trim() || null,
    surveyHeaderImageUrl:
      process.env.WHATSAPP_SURVEY_HEADER_IMAGE_URL?.trim() ||
      process.env.WHATSAPP_INVITE_HEADER_IMAGE_URL?.trim() ||
      null,
  };
}

export async function getWhatsAppConfig(): Promise<WhatsAppConfig> {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_MS) return cached.value;

  const templates = envTemplates();
  const row = await prisma.appConfig.findUnique({ where: { id: "app" } });
  const envProvider = process.env.WHATSAPP_PROVIDER?.trim();
  const envUrl = process.env.WHATSAPP_API_URL?.trim() || null;
  const envToken =
    process.env.WHATSAPP_API_TOKEN?.trim() ||
    process.env.WHATSAPP_API_KEY?.trim() ||
    null;
  const envSender =
    process.env.WHATSAPP_USERNAME?.trim() ||
    process.env.WHATSAPP_SENDER?.trim() ||
    null;

  // Coolify/env يتقدم إن وُجد؛ وإلا إعدادات الواجهة — O(1)
  const value: WhatsAppConfig = {
    provider: (
      envProvider ||
      row?.whatsappProvider ||
      "stub"
    ).toLowerCase(),
    apiUrl: envUrl || row?.whatsappApiUrl || null,
    apiToken: envToken || row?.whatsappApiToken || null,
    sender: envSender || row?.whatsappSender || null,
    source: envProvider || envUrl || envToken ? "env" : row ? "database" : "env",
    ...templates,
  };

  if (value.provider === "zad" && !value.apiUrl) {
    value.apiUrl = ZAD_DEFAULT_URL;
  }

  cached = { at: now, value };
  return value;
}

/** إبطال الكاش بعد حفظ إعدادات واتساب — O(1) */
export function clearWhatsAppConfigCache(): void {
  cached = null;
}

/** إخفاء التوكن: أول 4 وآخر 4 فقط — O(1) */
export function maskToken(token: string | null | undefined): string {
  if (!token) return "";
  if (token.length <= 8) return "••••";
  return `${token.slice(0, 4)}••••${token.slice(-4)}`;
}

export { ZAD_DEFAULT_URL };

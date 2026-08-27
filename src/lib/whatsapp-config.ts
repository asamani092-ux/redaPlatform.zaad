import { prisma } from "@/lib/prisma";

/**
 * إعداد واتساب: قاعدة البيانات أولاً (قابل للتعديل من الواجهة)،
 * ومتغيرات البيئة كقيمة افتراضية للتوافق الخلفي — O(1) لكل قراءة.
 */
/** يُمرَّر مكان {{exhibition}} في قالب الشكر لرسالة المتطوع */
export const DEFAULT_VOLUNTEER_THANKS_TAGLINE = "مشاركتك معنا سبب للنجاح";

export type WhatsAppConfig = {
  provider: string;
  apiUrl: string | null;
  apiToken: string | null;
  sender: string | null;
  source: "database" | "env";
  inviteTemplateId: string | null;
  thanksTemplateId: string | null;
  volunteerThanksTemplateId: string | null;
  /** نص VOL — يُستبدل به اسم المعرض في المعامل الثاني لنفس قالب الشكر */
  volunteerThanksTagline: string | null;
  surveyTemplateId: string | null;
};

/** كاش طلب قصير لتفادي N قراءات AppConfig في البث الجماعي */
let cached: { at: number; value: WhatsAppConfig } | null = null;
const CACHE_MS = 5_000;

const ZAD_DEFAULT_URL =
  "https://wawebhook.icsl.me/whatsapp-automation/wa/send-template";

function envTemplates() {
  return {
    inviteTemplateId: process.env.WHATSAPP_INVITE_TEMPLATE_ID?.trim() || null,
    thanksTemplateId: process.env.WHATSAPP_THANKS_TEMPLATE_ID?.trim() || null,
    volunteerThanksTemplateId:
      process.env.WHATSAPP_VOLUNTEER_THANKS_TEMPLATE_ID?.trim() || null,
    volunteerThanksTagline:
      process.env.WHATSAPP_VOLUNTEER_THANKS_TAGLINE?.trim() || null,
    surveyTemplateId: process.env.WHATSAPP_SURVEY_TEMPLATE_ID?.trim() || null,
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

/**
 * نفس قالب الشكر (معاملاً) — Time O(1)، Space O(1).
 * المستفيد: [exhibition, name] | المتطوع: [VOL, name]
 */
export function buildVolunteerThanksTemplateParams(
  config: WhatsAppConfig,
  name: string,
): string[] {
  const vol =
    config.volunteerThanksTagline?.trim() || DEFAULT_VOLUNTEER_THANKS_TAGLINE;
  return [vol, name];
}

export function volunteerThanksBodyText(
  config: WhatsAppConfig,
  name: string,
): string {
  const vol =
    config.volunteerThanksTagline?.trim() || DEFAULT_VOLUNTEER_THANKS_TAGLINE;
  return `شكراً لزيارتك ${vol}، ${name}.`;
}

export { ZAD_DEFAULT_URL };

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { OutboundMessageStatus, OutboundMessageType } from "@/generated/prisma/enums";
import { getWhatsAppConfig, type WhatsAppConfig } from "@/lib/whatsapp-config";
import { isValidSaudiMobile, normalizeMobile, toWaId } from "@/lib/mobile";

export type WhatsAppSendInput = {
  exhibitionId?: string;
  beneficiaryId?: string;
  mobile: string;
  body: string;
  type: OutboundMessageType;
  createdById?: string;
  /**
   * رابط صورة عامة للهيدر (بوستر أو باركود PNG).
   * على ZAD يُمرَّر كـ header image إن وُجد.
   */
  mediaUrl?: string;
  /**
   * متغيرات body للقالب بالترتيب (ZAD).
   * يتجاوز اختيار القالب الافتراضي حسب النوع إن وُجد templateIdOverride.
   */
  templateParams?: string[];
  /** معرّف قالب صريح (مثلاً قالب باركود الدعوة) */
  templateIdOverride?: string | null;
};

function templateIdFor(
  config: WhatsAppConfig,
  type: OutboundMessageType,
  override?: string | null,
): string | null {
  if (override?.trim()) return override.trim();
  switch (type) {
    case OutboundMessageType.INVITATION:
      return config.inviteTemplateId;
    case OutboundMessageType.THANK_YOU:
      return config.thanksTemplateId;
    case OutboundMessageType.SURVEY:
      return config.surveyTemplateId;
    default:
      return null;
  }
}

type ZadSendResult = { providerRef?: string; raw?: unknown };

/**
 * إرسال قالب ZAD — body نصي + header صورة اختيارية.
 * Time O(1)، Space O(1).
 */
async function sendZadTemplate(input: {
  apiUrl: string;
  apiKey: string;
  userName: string;
  mobile: string;
  templateId: string;
  params: string[];
  headerImageUrl?: string | null;
}): Promise<ZadSendResult> {
  const waId = toWaId(input.mobile);
  const url = new URL(input.apiUrl);
  url.searchParams.set("apiKey", input.apiKey);

  const params: Array<Record<string, unknown>> = [];
  if (input.headerImageUrl?.trim()) {
    params.push({
      type: "header",
      parameters: [
        {
          type: "image",
          image: { link: input.headerImageUrl.trim() },
        },
      ],
    });
  }
  // قالب الباركود: هيدر صورة فقط — لا نرسل body فارغاً
  if (input.params.length > 0) {
    params.push({
      type: "body",
      parameters: input.params.map((text) => ({ type: "text", text })),
    });
  }

  const payload = {
    userName: input.userName,
    wa_id: waId,
    templateId: input.templateId,
    params,
  };

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apiKey: input.apiKey,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let raw: unknown = {};
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    raw = { raw: text };
  }

  if (!res.ok) {
    throw new Error(
      typeof raw === "object" && raw && "message" in raw
        ? String((raw as { message: unknown }).message)
        : text || `WhatsApp API ${res.status}`,
    );
  }

  const ref =
    typeof raw === "object" && raw && "id" in raw
      ? String((raw as { id: unknown }).id)
      : typeof raw === "object" && raw && "messageId" in raw
        ? String((raw as { messageId: unknown }).messageId)
        : undefined;

  return { providerRef: ref, raw };
}

/**
 * منفذ واتساب: stub | zad | api (Bearer).
 * Time O(1) لكل رسالة، Space O(1).
 */
export async function sendWhatsAppMessage(input: WhatsAppSendInput) {
  const config = await getWhatsAppConfig();
  const provider = (config.provider || "stub").toLowerCase();
  const mobile = normalizeMobile(input.mobile);
  const templateParams = input.templateParams ?? [];

  const basePayload = {
    mobile,
    body: input.body,
    mediaUrl: input.mediaUrl ?? null,
    templateParams,
    templateIdOverride: input.templateIdOverride ?? null,
    provider,
  };

  if (provider === "stub") {
    return prisma.outboundMessage.create({
      data: {
        exhibitionId: input.exhibitionId,
        beneficiaryId: input.beneficiaryId,
        type: input.type,
        status: OutboundMessageStatus.STUBBED,
        payloadJson: basePayload as Prisma.InputJsonValue,
        createdById: input.createdById,
      },
    });
  }

  if (!isValidSaudiMobile(mobile)) {
    return prisma.outboundMessage.create({
      data: {
        exhibitionId: input.exhibitionId,
        beneficiaryId: input.beneficiaryId,
        type: input.type,
        status: OutboundMessageStatus.FAILED,
        errorMessage: "رقم الجوال غير صالح — الصيغة: 05xxxxxxxx",
        payloadJson: basePayload as Prisma.InputJsonValue,
        createdById: input.createdById,
      },
    });
  }

  try {
    if (provider === "zad") {
      const apiUrl = config.apiUrl;
      const apiKey = config.apiToken;
      if (!apiUrl || !apiKey) {
        throw new Error("رابط ZAD أو apiKey غير مضبوط — من الإعدادات أو متغيرات البيئة");
      }

      const templateId = templateIdFor(
        config,
        input.type,
        input.templateIdOverride,
      );
      if (!templateId) {
        throw new Error(
          `مزوّد ZAD لا يدعم النوع ${input.type} أو معرّف القالب غير مضبوط في البيئة`,
        );
      }
      if (!templateParams.length && !input.mediaUrl?.trim()) {
        throw new Error("templateParams أو صورة الهيدر مطلوبة لمزوّد ZAD");
      }

      const result = await sendZadTemplate({
        apiUrl,
        apiKey,
        userName: config.sender?.trim() || "platform",
        mobile,
        templateId,
        params: templateParams,
        headerImageUrl: input.mediaUrl,
      });

      return prisma.outboundMessage.create({
        data: {
          exhibitionId: input.exhibitionId,
          beneficiaryId: input.beneficiaryId,
          type: input.type,
          status: OutboundMessageStatus.SENT,
          providerRef: result.providerRef,
          payloadJson: {
            ...basePayload,
            wa_id: toWaId(mobile),
            templateId,
            headerImageUrl: input.mediaUrl ?? null,
            response: result.raw as Prisma.InputJsonValue,
          } as Prisma.InputJsonValue,
          createdById: input.createdById,
        },
      });
    }

    // مزوّد عام (api / Bearer)
    const apiUrl = config.apiUrl;
    const token = config.apiToken;
    if (!apiUrl || !token) {
      throw new Error("رابط الإرسال أو التوكن غير مضبوط — اضبطهما من الإعدادات");
    }

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: mobile,
        body: input.body,
        ...(input.mediaUrl ? { mediaUrl: input.mediaUrl, type: "image" } : {}),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `WhatsApp API ${res.status}`);
    }

    const data = (await res.json().catch(() => ({}))) as { id?: string };

    return prisma.outboundMessage.create({
      data: {
        exhibitionId: input.exhibitionId,
        beneficiaryId: input.beneficiaryId,
        type: input.type,
        status: OutboundMessageStatus.SENT,
        providerRef: data.id,
        payloadJson: basePayload as Prisma.InputJsonValue,
        createdById: input.createdById,
      },
    });
  } catch (error) {
    return prisma.outboundMessage.create({
      data: {
        exhibitionId: input.exhibitionId,
        beneficiaryId: input.beneficiaryId,
        type: input.type,
        status: OutboundMessageStatus.FAILED,
        errorMessage: error instanceof Error ? error.message : "unknown",
        payloadJson: basePayload as Prisma.InputJsonValue,
        createdById: input.createdById,
      },
    });
  }
}

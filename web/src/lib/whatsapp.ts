import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { OutboundMessageStatus, OutboundMessageType } from "@/generated/prisma/enums";
import { isValidSaudiMobile, normalizeMobile, toWaId } from "@/lib/mobile";

export type WhatsAppSendInput = {
  exhibitionId?: string;
  beneficiaryId?: string;
  mobile: string;
  /** نص للـ stub / سجل التدقيق (القوالب الحقيقية من المزوّد) */
  body: string;
  type: OutboundMessageType;
  createdById?: string;
  /**
   * متغيرات body للقالب بالترتيب المتوقع من ZAD.
   * INVITATION: name, exhibition, date, location, qr_url
   * THANK_YOU: name, exhibition
   * SURVEY: name, exhibition, survey_url
   */
  templateParams?: string[];
};

function templateIdFor(type: OutboundMessageType): string | undefined {
  switch (type) {
    case OutboundMessageType.INVITATION:
      return process.env.WHATSAPP_INVITE_TEMPLATE_ID;
    case OutboundMessageType.THANK_YOU:
      return process.env.WHATSAPP_THANKS_TEMPLATE_ID;
    case OutboundMessageType.SURVEY:
      return process.env.WHATSAPP_SURVEY_TEMPLATE_ID;
    default:
      return undefined;
  }
}

type ZadSendResult = { providerRef?: string; raw?: unknown };

/**
 * إرسال قالب ZAD — Time O(1)، Space O(1) لكل رسالة.
 */
async function sendZadTemplate(input: {
  mobile: string;
  templateId: string;
  params: string[];
}): Promise<ZadSendResult> {
  const apiUrl =
    process.env.WHATSAPP_API_URL ??
    "https://wawebhook.icsl.me/whatsapp-automation/wa/send-template";
  const apiKey = process.env.WHATSAPP_API_KEY;
  const userName = process.env.WHATSAPP_USERNAME ?? "platform";
  if (!apiKey) {
    throw new Error("WHATSAPP_API_KEY غير مضبوط");
  }

  const waId = toWaId(input.mobile);
  const url = new URL(apiUrl);
  url.searchParams.set("apiKey", apiKey);

  const payload = {
    userName,
    wa_id: waId,
    templateId: input.templateId,
    params: [
      {
        type: "body",
        parameters: input.params.map((text) => ({ type: "text", text })),
      },
    ],
  };

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apiKey,
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
 * منفذ واتساب: stub | zad | generic Bearer.
 * Time O(1) لكل رسالة، Space O(1).
 */
export async function sendWhatsAppMessage(input: WhatsAppSendInput) {
  const provider = (process.env.WHATSAPP_PROVIDER ?? "stub").toLowerCase();
  const mobile = normalizeMobile(input.mobile);
  const templateParams = input.templateParams ?? [];

  const basePayload = {
    mobile,
    body: input.body,
    templateParams,
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
      const templateId = templateIdFor(input.type);
      if (!templateId) {
        throw new Error(`معرّف قالب واتساب غير مضبوط للنوع ${input.type}`);
      }
      if (!templateParams.length) {
        throw new Error("templateParams مطلوبة لمزوّد ZAD");
      }

      const result = await sendZadTemplate({
        mobile,
        templateId,
        params: templateParams,
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
            response: result.raw as Prisma.InputJsonValue,
          } as Prisma.InputJsonValue,
          createdById: input.createdById,
        },
      });
    }

    // مزوّد عام (Bearer + body) للتوافق الخلفي
    const apiUrl = process.env.WHATSAPP_API_URL;
    const token = process.env.WHATSAPP_API_TOKEN ?? process.env.WHATSAPP_API_KEY;
    if (!apiUrl || !token) {
      throw new Error("WHATSAPP_API_URL أو التوكن غير مضبوط");
    }

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to: mobile, body: input.body }),
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

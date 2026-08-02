import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { OutboundMessageStatus, OutboundMessageType } from "@/generated/prisma/enums";
import { getWhatsAppConfig } from "@/lib/whatsapp-config";

export type WhatsAppSendInput = {
  exhibitionId?: string;
  beneficiaryId?: string;
  mobile: string;
  body: string;
  type: OutboundMessageType;
  createdById?: string;
  /** رابط صورة عامة (QR) إن دعمها المزوّد */
  mediaUrl?: string;
};

/**
 * منفذ واتساب قابل للاستبدال — الإعداد من قاعدة البيانات (شاشة الإعدادات)
 * مع متغيرات البيئة كافتراضي. Time: O(1) لكل رسالة.
 */
export async function sendWhatsAppMessage(input: WhatsAppSendInput) {
  const config = await getWhatsAppConfig();
  const provider = config.provider;

  if (provider === "stub") {
    return prisma.outboundMessage.create({
      data: {
        exhibitionId: input.exhibitionId,
        beneficiaryId: input.beneficiaryId,
        type: input.type,
        status: OutboundMessageStatus.STUBBED,
        payloadJson: {
          mobile: input.mobile,
          body: input.body,
          mediaUrl: input.mediaUrl ?? null,
          provider: "stub",
        } as Prisma.InputJsonValue,
        createdById: input.createdById,
      },
    });
  }

  try {
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
        to: input.mobile,
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
        payloadJson: {
          mobile: input.mobile,
          body: input.body,
          mediaUrl: input.mediaUrl ?? null,
          provider,
        } as Prisma.InputJsonValue,
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
        payloadJson: {
          mobile: input.mobile,
          body: input.body,
          mediaUrl: input.mediaUrl ?? null,
          provider,
        } as Prisma.InputJsonValue,
        createdById: input.createdById,
      },
    });
  }
}

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { OutboundMessageStatus, OutboundMessageType } from "@/generated/prisma/enums";

export type WhatsAppSendInput = {
  exhibitionId?: string;
  beneficiaryId?: string;
  mobile: string;
  body: string;
  type: OutboundMessageType;
  createdById?: string;
};

/**
 * منفذ واتساب قابل للاستبدال — حالياً stub حتى نهاية التجربة.
 * Time: O(1) لكل رسالة.
 */
export async function sendWhatsAppMessage(input: WhatsAppSendInput) {
  const provider = process.env.WHATSAPP_PROVIDER ?? "stub";

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
          provider: "stub",
        } as Prisma.InputJsonValue,
        createdById: input.createdById,
      },
    });
  }

  // ربط المزوّد الحقيقي لاحقاً عبر WHATSAPP_API_URL / WHATSAPP_API_TOKEN
  try {
    const apiUrl = process.env.WHATSAPP_API_URL;
    const token = process.env.WHATSAPP_API_TOKEN;
    if (!apiUrl || !token) {
      throw new Error("WHATSAPP_API_URL أو WHATSAPP_API_TOKEN غير مضبوط");
    }

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to: input.mobile, body: input.body }),
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
          provider,
        } as Prisma.InputJsonValue,
        createdById: input.createdById,
      },
    });
  }
}

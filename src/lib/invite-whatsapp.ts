import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { OutboundMessageStatus, OutboundMessageType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { appOrigin } from "@/lib/app-url";
import { isValidSaudiMobile, MOBILE_ERROR, normalizeMobile } from "@/lib/mobile";
import { getWhatsAppConfig } from "@/lib/whatsapp-config";

type ExhibitionInviteCtx = {
  id: string;
  name: string;
  location: string | null;
  startsAt: Date | null;
  settings?: { whatsappInviteTpl?: string | null } | null;
};

export type InviteSendResult = {
  beneficiaryId: string;
  beneficiaryName: string;
  mobile: string;
  status: "SENT" | "STUBBED" | "FAILED" | "PARTIAL";
  reason: string | null;
};

/** بناء نص الدعوة — O(1) */
export function buildInviteBodyText(input: {
  tpl: string;
  name: string;
  exhibitionName: string;
  date: string;
  location: string;
  qrToken: string;
  qrUrl: string;
}): string {
  let bodyText = input.tpl
    .replaceAll("{{name}}", input.name)
    .replaceAll("{{exhibition}}", input.exhibitionName)
    .replaceAll("{{date}}", input.date)
    .replaceAll("{{location}}", input.location)
    .replaceAll("{{qr}}", input.qrToken)
    .replaceAll("{{qr_url}}", input.qrUrl);
  if (!input.tpl.includes("{{location}}") && input.location) {
    bodyText += `\nالموقع: ${input.location}`;
  }
  return bodyText;
}

function okStatus(status: string): "SENT" | "STUBBED" | null {
  if (status === "SENT") return "SENT";
  if (status === "STUBBED") return "STUBBED";
  return null;
}

/**
 * إرسال دعوتي واتساب متتابعتين لنفس المستفيد:
 * 1) نص + صورة بوستر (هيدر القالب أو WHATSAPP_INVITE_HEADER_IMAGE_URL)
 * 2) نص + صورة الباركود (PNG عام لكل مدعو)
 * Time: O(1) لكل مستفيد.
 */
export async function sendInviteWhatsApp(input: {
  req: NextRequest;
  exhibition: ExhibitionInviteCtx;
  beneficiary: { id: string; name: string; mobile: string };
  qrToken: string;
  createdById: string;
  /** تاريخ الحضور لهذا المدعو YYYY-MM-DD — يتجاوز startsAt إن وُجد */
  inviteDate?: string | null;
}): Promise<InviteSendResult> {
  const mobile = normalizeMobile(input.beneficiary.mobile);
  if (!isValidSaudiMobile(mobile)) {
    await prisma.outboundMessage.create({
      data: {
        exhibitionId: input.exhibition.id,
        beneficiaryId: input.beneficiary.id,
        type: OutboundMessageType.INVITATION,
        status: OutboundMessageStatus.FAILED,
        errorMessage: MOBILE_ERROR,
        payloadJson: {
          mobile: input.beneficiary.mobile,
          body: null,
          mediaUrl: null,
          provider: "validation",
          part: "invite",
        } as Prisma.InputJsonValue,
        createdById: input.createdById,
      },
    });
    return {
      beneficiaryId: input.beneficiary.id,
      beneficiaryName: input.beneficiary.name,
      mobile: input.beneficiary.mobile,
      status: "FAILED",
      reason: MOBILE_ERROR,
    };
  }

  const origin = appOrigin(input.req);
  /** صورة PNG عامة للهيدر — وليست رابطاً نصياً للمستفيد */
  const qrImageUrl = `${origin}/api/qr/public/${input.qrToken}`;
  const inviteDateRaw = input.inviteDate?.trim() || "";
  const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(inviteDateRaw)
    ? inviteDateRaw
    : (input.exhibition.startsAt?.toISOString().slice(0, 10) ?? "");
  const location = input.exhibition.location ?? "";
  const tpl =
    input.exhibition.settings?.whatsappInviteTpl ??
    "مرحباً {{name}}، أنت مدعو إلى {{exhibition}}. الموعد: {{date}} — الموقع: {{location}}";
  const bodyText = buildInviteBodyText({
    tpl,
    name: input.beneficiary.name,
    exhibitionName: input.exhibition.name,
    date: dateStr,
    location,
    qrToken: input.qrToken,
    qrUrl: qrImageUrl,
  });

  const wa = await getWhatsAppConfig();

  // 1) رسالة الدعوة: نص + صورة بوستر (ثابتة في القالب أو رابط ديناميكي من env)
  const inviteMsg = await sendWhatsAppMessage({
    exhibitionId: input.exhibition.id,
    beneficiaryId: input.beneficiary.id,
    mobile,
    body: bodyText,
    mediaUrl: wa.inviteHeaderImageUrl || undefined,
    type: OutboundMessageType.INVITATION,
    createdById: input.createdById,
    templateIdOverride: wa.inviteTemplateId,
    templateParams: [
      input.beneficiary.name,
      input.exhibition.name,
      dateStr,
      location,
    ],
  });

  const inviteOk = okStatus(inviteMsg.status);
  if (!inviteOk) {
    return {
      beneficiaryId: input.beneficiary.id,
      beneficiaryName: input.beneficiary.name,
      mobile: input.beneficiary.mobile,
      status: "FAILED",
      reason: inviteMsg.errorMessage || "فشل إرسال رسالة الدعوة (البوستر)",
    };
  }

  // 2) رسالة الباركود فوراً: نص + صورة QR
  const qrTemplateId = wa.inviteQrTemplateId;
  if (!qrTemplateId) {
    return {
      beneficiaryId: input.beneficiary.id,
      beneficiaryName: input.beneficiary.name,
      mobile: input.beneficiary.mobile,
      status: "PARTIAL",
      reason:
        "أُرسلت الدعوة دون الباركود — عيّن WHATSAPP_INVITE_QR_TEMPLATE_ID في البيئة",
    };
  }

  const qrBody = `مرحباً ${input.beneficiary.name}، هذا رمز حضورك لمعرض ${input.exhibition.name}. أظهره عند الدخول.`;
  const qrMsg = await sendWhatsAppMessage({
    exhibitionId: input.exhibition.id,
    beneficiaryId: input.beneficiary.id,
    mobile,
    body: qrBody,
    mediaUrl: qrImageUrl,
    type: OutboundMessageType.INVITATION,
    createdById: input.createdById,
    templateIdOverride: qrTemplateId,
    templateParams: [input.beneficiary.name, input.exhibition.name],
  });

  const qrOk = okStatus(qrMsg.status);
  if (!qrOk) {
    return {
      beneficiaryId: input.beneficiary.id,
      beneficiaryName: input.beneficiary.name,
      mobile: input.beneficiary.mobile,
      status: "PARTIAL",
      reason: qrMsg.errorMessage || "أُرسلت الدعوة وفشل إرسال صورة الباركود",
    };
  }

  return {
    beneficiaryId: input.beneficiary.id,
    beneficiaryName: input.beneficiary.name,
    mobile: input.beneficiary.mobile,
    status: inviteOk === "STUBBED" || qrOk === "STUBBED" ? "STUBBED" : "SENT",
    reason: null,
  };
}

export function inviteWhatsappLabel(status: string | null | undefined): string {
  switch (status) {
    case "SENT":
      return "نجاح الإرسال";
    case "STUBBED":
      return "تجريبي (stub)";
    case "FAILED":
      return "فشل الإرسال";
    case "PENDING":
      return "قيد الإرسال";
    default:
      return "لم يُرسل";
  }
}

/** أحدث رسالة دعوة لكل مستفيد — O(n) */
export async function latestInviteMessages(
  exhibitionId: string,
  beneficiaryIds: string[],
): Promise<
  Map<string, { status: string; errorMessage: string | null; createdAt: Date }>
> {
  const map = new Map<
    string,
    { status: string; errorMessage: string | null; createdAt: Date }
  >();
  if (!beneficiaryIds.length) return map;

  const messages = await prisma.outboundMessage.findMany({
    where: {
      exhibitionId,
      beneficiaryId: { in: beneficiaryIds },
      type: OutboundMessageType.INVITATION,
    },
    orderBy: { createdAt: "desc" },
    select: {
      beneficiaryId: true,
      status: true,
      errorMessage: true,
      createdAt: true,
    },
  });

  for (const m of messages) {
    if (!m.beneficiaryId || map.has(m.beneficiaryId)) continue;
    map.set(m.beneficiaryId, {
      status: m.status,
      errorMessage: m.errorMessage,
      createdAt: m.createdAt,
    });
  }
  return map;
}

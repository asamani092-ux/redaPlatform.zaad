import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";
import { statusFromSendCounts } from "@/lib/audit-status";
import { requireActiveExhibition } from "@/lib/exhibition";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { OutboundMessageType } from "@/generated/prisma/enums";
import { randomUUID } from "crypto";
import { appOrigin } from "@/lib/app-url";
import { parsePageParams, paginatedPayload } from "@/lib/pagination";

const bulkSchema = z.object({
  beneficiaryIds: z.array(z.string()).min(1),
  /** افتراضي true — الدعوة بلا واتساب بلا فائدة تشغيلية */
  sendWhatsApp: z.boolean().optional().default(true),
});

export async function GET(req: NextRequest) {
  const authz = await requirePermission("invites:manage");
  if ("error" in authz) return authz.error;

  let exhibition;
  try {
    exhibition = await requireActiveExhibition();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "لا يوجد معرض نشط" },
      { status: 400 },
    );
  }
  const { page, pageSize, skip, take } = parsePageParams(req.nextUrl.searchParams);
  const where = { exhibitionId: exhibition.id, invited: true };
  const [total, invites] = await Promise.all([
    prisma.exhibitionInvite.count({ where }),
    prisma.exhibitionInvite.findMany({
      where,
      include: { beneficiary: { include: { association: true } } },
      orderBy: { invitedAt: "desc" },
      skip,
      take,
    }),
  ]);
  return NextResponse.json({
    ...paginatedPayload(invites, page, pageSize, total),
    exhibitionId: exhibition.id,
  });
}

export async function POST(req: NextRequest) {
  const authz = await requirePermission("invites:manage");
  if ("error" in authz) return authz.error;

  const body = bulkSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "حدد مستفيدين" }, { status: 400 });
  }

  let exhibition;
  try {
    exhibition = await requireActiveExhibition();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "لا يوجد معرض نشط" },
      { status: 400 },
    );
  }
  const uniqueIds = [...new Set(body.data.beneficiaryIds)];

  const result = await prisma.$transaction(async (tx) => {
    let invited = 0;
    const tokens: Array<{ beneficiaryId: string; qrToken: string }> = [];

    for (const beneficiaryId of uniqueIds) {
      const beneficiary = await tx.beneficiary.findUnique({ where: { id: beneficiaryId } });
      if (!beneficiary) continue;

      const invite = await tx.exhibitionInvite.upsert({
        where: {
          exhibitionId_beneficiaryId: {
            exhibitionId: exhibition.id,
            beneficiaryId,
          },
        },
        update: {
          invited: true,
          invitedAt: new Date(),
          invitedById: authz.userId,
        },
        create: {
          exhibitionId: exhibition.id,
          beneficiaryId,
          qrToken: randomUUID().replace(/-/g, ""),
          invited: true,
          invitedById: authz.userId,
        },
      });
      invited++;
      tokens.push({ beneficiaryId, qrToken: invite.qrToken });
    }
    return { invited, tokens };
  });

  let whatsappSent = 0;
  let whatsappFailed = 0;
  let whatsappStubbed = 0;
  const whatsappErrors: Array<{
    beneficiaryId: string;
    beneficiaryName: string;
    mobile: string;
    reason: string;
  }> = [];

  // إرسال واتساب مع QR هو المسار التشغيلي للدعوة
  if (body.data.sendWhatsApp !== false) {
    const origin = appOrigin(req);
    const tpl =
      exhibition.settings?.whatsappInviteTpl ??
      "مرحباً {{name}}، أنت مدعو إلى {{exhibition}}. الموعد: {{date}} — الموقع: {{location}}";
    for (const t of result.tokens) {
      const b = await prisma.beneficiary.findUnique({ where: { id: t.beneficiaryId } });
      if (!b) continue;
      const qrUrl = `${origin}/api/qr/public/${t.qrToken}`;
      let bodyText = tpl
        .replaceAll("{{name}}", b.name)
        .replaceAll("{{exhibition}}", exhibition.name)
        .replaceAll("{{date}}", exhibition.startsAt?.toISOString().slice(0, 10) ?? "")
        .replaceAll("{{location}}", exhibition.location ?? "")
        .replaceAll("{{qr}}", t.qrToken)
        .replaceAll("{{qr_url}}", qrUrl);
      // الدعوة تشمل الموقع دائماً حتى لو خلا القالب من {{location}}
      if (!tpl.includes("{{location}}") && exhibition.location) {
        bodyText += `\nالموقع: ${exhibition.location}`;
      }
      // إرفاق رمز المسح مع الدعوة (رابط صورة QR + نص الرمز)
      if (!tpl.includes("{{qr_url}}") && !bodyText.includes(qrUrl)) {
        bodyText += `\nرمز الحضور (امسحه عند الدخول):\n${qrUrl}`;
      }
      const msg = await sendWhatsAppMessage({
        exhibitionId: exhibition.id,
        beneficiaryId: b.id,
        mobile: b.mobile,
        body: bodyText,
        mediaUrl: qrUrl,
        type: OutboundMessageType.INVITATION,
        createdById: authz.userId,
      });
      if (msg.status === "FAILED") {
        whatsappFailed += 1;
        whatsappErrors.push({
          beneficiaryId: b.id,
          beneficiaryName: b.name,
          mobile: b.mobile,
          reason: msg.errorMessage || "فشل إرسال واتساب",
        });
      } else if (msg.status === "STUBBED") {
        whatsappStubbed += 1;
      } else {
        whatsappSent += 1;
      }
    }
  }

  const status = statusFromSendCounts({
    sent: whatsappSent,
    failed: whatsappFailed,
    stubbed: whatsappStubbed,
  });
  const statusReason =
    whatsappErrors.length > 0
      ? whatsappErrors
          .slice(0, 5)
          .map((e) => `${e.beneficiaryName}: ${e.reason}`)
          .join(" | ")
      : result.invited === 0
        ? "لم يُدعَ أي مستفيد"
        : null;

  await writeAuditLog({
    userId: authz.userId,
    action: "BULK_INVITE",
    entityType: "ExhibitionInvite",
    entityId: exhibition.id,
    meta: {
      count: result.invited,
      beneficiaryIds: uniqueIds,
      whatsappSent,
      whatsappFailed,
      whatsappStubbed,
      errors: whatsappErrors.slice(0, 20),
    },
    status: result.invited === 0 ? "FAILED" : status,
    statusReason,
  });

  return NextResponse.json({
    invited: result.invited,
    whatsappSent,
    whatsappFailed,
    whatsappStubbed,
    whatsappErrors,
    status,
    statusReason,
  });
}

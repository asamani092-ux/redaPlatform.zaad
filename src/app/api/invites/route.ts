import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";
import { requireActiveExhibition } from "@/lib/exhibition";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { OutboundMessageType } from "@/generated/prisma/enums";
import { randomUUID } from "crypto";

const bulkSchema = z.object({
  beneficiaryIds: z.array(z.string()).min(1),
  sendWhatsApp: z.boolean().optional(),
});

export async function GET() {
  const authz = await requirePermission("invites:manage");
  if ("error" in authz) return authz.error;

  const exhibition = await requireActiveExhibition();
  const invites = await prisma.exhibitionInvite.findMany({
    where: { exhibitionId: exhibition.id, invited: true },
    include: { beneficiary: { include: { association: true } } },
    orderBy: { invitedAt: "desc" },
    take: 500,
  });
  return NextResponse.json({ data: invites, exhibitionId: exhibition.id });
}

export async function POST(req: NextRequest) {
  const authz = await requirePermission("invites:manage");
  if ("error" in authz) return authz.error;

  const body = bulkSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "حدد مستفيدين" }, { status: 400 });
  }

  const exhibition = await requireActiveExhibition();
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

  await writeAuditLog({
    userId: authz.userId,
    action: "BULK_INVITE",
    entityType: "ExhibitionInvite",
    entityId: exhibition.id,
    meta: { count: result.invited, beneficiaryIds: uniqueIds },
  });

  if (body.data.sendWhatsApp) {
    const tpl =
      exhibition.settings?.whatsappInviteTpl ??
      "مرحباً {{name}}، أنت مدعو لمعرض رداء.";
    for (const t of result.tokens) {
      const b = await prisma.beneficiary.findUnique({ where: { id: t.beneficiaryId } });
      if (!b) continue;
      const bodyText = tpl
        .replaceAll("{{name}}", b.name)
        .replaceAll("{{date}}", exhibition.startsAt?.toISOString().slice(0, 10) ?? "")
        .replaceAll("{{location}}", exhibition.location ?? "")
        .replaceAll("{{qr}}", t.qrToken);
      await sendWhatsAppMessage({
        exhibitionId: exhibition.id,
        beneficiaryId: b.id,
        mobile: b.mobile,
        body: bodyText,
        type: OutboundMessageType.INVITATION,
        createdById: authz.userId,
      });
    }
  }

  return NextResponse.json({ invited: result.invited });
}

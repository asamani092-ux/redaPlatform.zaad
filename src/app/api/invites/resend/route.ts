import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";
import { statusFromSendCounts } from "@/lib/audit-status";
import { requireActiveExhibition } from "@/lib/exhibition";
import { sendInviteWhatsApp } from "@/lib/invite-whatsapp";

const schema = z.object({
  beneficiaryIds: z.array(z.string()).min(1),
});

/**
 * إعادة إرسال دعوة واتساب لمدعوين موجودين — تراكمي (رسالة جديدة)، O(n).
 */
export async function POST(req: NextRequest) {
  const authz = await requirePermission("invites:manage");
  if ("error" in authz) return authz.error;

  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "حدد مستفيدين لإعادة الإرسال" }, { status: 400 });
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
  const invites = await prisma.exhibitionInvite.findMany({
    where: {
      exhibitionId: exhibition.id,
      invited: true,
      beneficiaryId: { in: uniqueIds },
    },
    include: { beneficiary: true },
  });

  if (!invites.length) {
    return NextResponse.json(
      { error: "لا دعوات مطابقة لإعادة الإرسال — ادعُ المستفيد أولاً" },
      { status: 404 },
    );
  }

  let whatsappSent = 0;
  let whatsappFailed = 0;
  let whatsappStubbed = 0;
  const whatsappErrors: Array<{
    beneficiaryId: string;
    beneficiaryName: string;
    mobile: string;
    reason: string;
  }> = [];
  const results: Array<{
    beneficiaryId: string;
    status: string;
    reason: string | null;
  }> = [];

  for (const inv of invites) {
    const send = await sendInviteWhatsApp({
      req,
      exhibition,
      beneficiary: inv.beneficiary,
      qrToken: inv.qrToken,
      createdById: authz.userId,
    });
    results.push({
      beneficiaryId: send.beneficiaryId,
      status: send.status,
      reason: send.reason,
    });
    if (send.status === "FAILED") {
      whatsappFailed += 1;
      whatsappErrors.push({
        beneficiaryId: send.beneficiaryId,
        beneficiaryName: send.beneficiaryName,
        mobile: send.mobile,
        reason: send.reason || "فشل إرسال واتساب",
      });
    } else if (send.status === "STUBBED") {
      whatsappStubbed += 1;
    } else {
      whatsappSent += 1;
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
      : null;

  await writeAuditLog({
    userId: authz.userId,
    action: "INVITE_RESEND",
    entityType: "ExhibitionInvite",
    entityId: exhibition.id,
    meta: {
      count: invites.length,
      whatsappSent,
      whatsappFailed,
      whatsappStubbed,
      errors: whatsappErrors.slice(0, 20),
      results: results.slice(0, 50),
    },
    status,
    statusReason,
  });

  return NextResponse.json({
    resent: invites.length,
    whatsappSent,
    whatsappFailed,
    whatsappStubbed,
    whatsappErrors,
    results,
    status,
    statusReason,
  });
}

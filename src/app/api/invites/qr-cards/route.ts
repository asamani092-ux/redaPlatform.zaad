import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { requireActiveExhibition } from "@/lib/exhibition";
import { buildInviteQrCardsPdf } from "@/lib/qr-cards-pdf";
import { writeAuditLog } from "@/lib/audit";

/** بطاقات QR مطبوعة بدل الرسائل الحية لهذا المعرض */
export async function GET() {
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

  const invites = await prisma.exhibitionInvite.findMany({
    where: { exhibitionId: exhibition.id, invited: true },
    include: { beneficiary: true },
    orderBy: { invitedAt: "asc" },
  });

  const pdf = await buildInviteQrCardsPdf(
    invites.map((inv) => ({
      exhibitionName: exhibition.name,
      name: inv.beneficiary.name,
      nationalId: inv.beneficiary.nationalId,
      qrToken: inv.qrToken,
    })),
  );

  await writeAuditLog({
    userId: authz.userId,
    action: "QR_CARDS_EXPORT",
    entityType: "ExhibitionInvite",
    entityId: exhibition.id,
    meta: { count: invites.length, format: "pdf" },
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ridaa-qr-cards.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

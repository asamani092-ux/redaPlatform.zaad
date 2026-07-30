import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { requireActiveExhibition } from "@/lib/exhibition";

export async function GET() {
  const authz = await requirePermission("dashboard:view");
  if ("error" in authz) return authz.error;

  const exhibition = await requireActiveExhibition();
  const exhibitionId = exhibition.id;

  const [
    totalBeneficiaries,
    invited,
    attended,
    received,
    exceptions,
    piecesAgg,
    inventory,
  ] = await Promise.all([
    prisma.beneficiary.count(),
    prisma.exhibitionInvite.count({ where: { exhibitionId, invited: true } }),
    prisma.attendance.count({ where: { exhibitionId } }),
    prisma.dispenseOrder.count({ where: { exhibitionId } }),
    prisma.attendance.count({ where: { exhibitionId, type: "EXCEPTION" } }),
    prisma.dispenseOrder.aggregate({
      where: { exhibitionId },
      _sum: { piecesCount: true },
    }),
    prisma.inventoryItem.findMany({ where: { exhibitionId } }),
  ]);

  const remainingToReceive = Math.max(attended - received, 0);
  const piecesDispensed = piecesAgg._sum.piecesCount ?? 0;
  const completionRate = invited > 0 ? Math.round((received / invited) * 100) : 0;
  const threshold = exhibition.settings?.lowStockThreshold ?? 10;

  const topItems = await prisma.dispenseLine.groupBy({
    by: ["inventoryItemId"],
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: 5,
  });

  const topDetailed = await Promise.all(
    topItems.map(async (t) => {
      const item = await prisma.inventoryItem.findUnique({ where: { id: t.inventoryItemId } });
      return {
        inventoryItemId: t.inventoryItemId,
        quantity: Number(t._sum.quantity ?? 0),
        attributes: item?.attributesJson ?? {},
      };
    }),
  );

  return NextResponse.json({
    exhibition: {
      id: exhibition.id,
      name: exhibition.name,
      location: exhibition.location,
    },
    stats: {
      totalBeneficiaries,
      invited,
      attended,
      received,
      remainingToReceive,
      piecesDispensed,
      exceptions,
      completionRate,
    },
    inventory: inventory.map((i) => ({
      id: i.id,
      attributes: i.attributesJson,
      quantity: Number(i.quantity),
      lowStock: Number(i.quantity) <= threshold,
    })),
    topItems: topDetailed,
  });
}

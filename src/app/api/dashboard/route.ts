import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { requireActiveExhibition } from "@/lib/exhibition";
import { DEFAULT_INVENTORY_SCHEMA, parseInventorySchema } from "@/lib/inventory-schema";
import { fetchTopDispensedItems } from "@/lib/top-dispensed";
import { countDistinctReceived } from "@/lib/report-counts";
import { householdSize } from "@/lib/report-metrics";
import { summarizePlatformStock, summarizeStoreStock } from "@/lib/store-ledger";
import { sponsorLogoPublicUrl } from "@/lib/uploads";

/**
 * لوحة التحكم — مؤشرات العميل + تشغيلي.
 * Time: O(a + d + s) حيث a حضور، d أسطر صرف، s داعمين.
 */
export async function GET() {
  const authz = await requirePermission("dashboard:view");
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
  const exhibitionId = exhibition.id;

  const [
    attendanceRows,
    invited,
    attended,
    received,
    exceptions,
    overrideDispenses,
    piecesAgg,
    inventory,
    topDetailed,
    storeSummary,
    platformStock,
    dispenseLines,
    associationCount,
    sponsors,
  ] = await Promise.all([
    prisma.attendance.findMany({
      where: { exhibitionId },
      select: {
        beneficiary: {
          select: {
            dependentsCount: true,
            associationId: true,
            associationOther: true,
          },
        },
      },
    }),
    prisma.exhibitionInvite.count({ where: { exhibitionId, invited: true } }),
    prisma.attendance.count({ where: { exhibitionId } }),
    countDistinctReceived(exhibitionId),
    prisma.attendance.count({ where: { exhibitionId, type: "EXCEPTION" } }),
    prisma.dispenseOrder.count({
      where: { exhibitionId, entitledOverride: { not: null } },
    }),
    prisma.dispenseOrder.aggregate({
      where: { exhibitionId },
      _sum: { piecesCount: true },
    }),
    prisma.inventoryItem.findMany({
      where: { exhibitionId },
      select: { id: true, skuCode: true, attributesJson: true, quantity: true },
    }),
    fetchTopDispensedItems(exhibitionId, 5),
    summarizeStoreStock(prisma, exhibitionId),
    summarizePlatformStock(prisma, exhibitionId),
    prisma.dispenseLine.findMany({
      where: { dispenseOrder: { exhibitionId } },
      select: {
        quantity: true,
        inventoryItem: { select: { attributesJson: true } },
      },
    }),
    prisma.associationOption.count({ where: { active: true } }),
    prisma.sponsor.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, logoPath: true },
    }),
  ]);

  // حضور: أسر = سجلات الحضور؛ أفراد = Σ(1+تابعين)
  let attendedIndividuals = 0;
  let associationAttendedFamilies = 0;
  for (const row of attendanceRows) {
    const deps = row.beneficiary?.dependentsCount ?? 0;
    attendedIndividuals += householdSize(deps);
    const hasAssoc =
      Boolean(row.beneficiary?.associationId) ||
      Boolean(row.beneficiary?.associationOther?.trim());
    if (hasAssoc) associationAttendedFamilies += 1;
  }
  const attendedFamilies = attendanceRows.length;

  let clothesPiecesDispensed = 0;
  let fabricMetersDispensed = 0;
  for (const line of dispenseLines) {
    const qty = Number(line.quantity);
    const attrs = (line.inventoryItem.attributesJson ?? {}) as Record<string, unknown>;
    const unit = String(attrs.unit ?? "").trim();
    if (unit === "قطعة") clothesPiecesDispensed += qty;
    else if (unit === "متر") fabricMetersDispensed += qty;
  }

  const remainingToReceive = Math.max(attended - received, 0);
  const piecesDispensed = piecesAgg._sum.piecesCount ?? 0;
  const completionRate =
    attended > 0 ? Math.min(100, Math.round((received / attended) * 100)) : 0;
  const threshold = exhibition.settings?.lowStockThreshold ?? 10;

  const schema = parseInventorySchema(exhibition.settings?.inventorySchemaJson);
  const attributeLabels = Object.fromEntries(
    (schema.length ? schema : DEFAULT_INVENTORY_SCHEMA).map((f) => [f.key, f.label]),
  );

  const storeContributed = storeSummary.reduce((s, r) => s + r.added, 0);
  const storeDispensed = storeSummary.reduce((s, r) => s + r.dispensed, 0);
  const storeRemaining = storeSummary.reduce((s, r) => s + r.remaining, 0);
  const inventoryRemaining = inventory.reduce((s, i) => s + Number(i.quantity), 0);

  return NextResponse.json({
    exhibition: {
      id: exhibition.id,
      name: exhibition.name,
      location: exhibition.location,
    },
    stats: {
      /** توافق خلفي */
      totalBeneficiaries: attendedFamilies,
      beneficiaryFamilies: attendedFamilies,
      totalIndividuals: attendedIndividuals,
      attendedFamilies,
      attendedIndividuals,
      invited,
      attended,
      received,
      remainingToReceive,
      piecesDispensed,
      clothesPiecesDispensed,
      fabricMetersDispensed,
      associationCount,
      associationAttendedFamilies,
      exceptions,
      overrideDispenses,
      completionRate,
      inventoryRemaining,
      platformContributed: platformStock.added,
      platformDispensed: platformStock.dispensed,
      platformRemaining: platformStock.remaining,
      storeContributed,
      storeDispensed,
      storeRemaining,
    },
    sponsors: sponsors.map((s) => ({
      id: s.id,
      name: s.name,
      logoUrl: sponsorLogoPublicUrl(s.logoPath),
    })),
    attributeLabels,
    inventorySchema: schema,
    inventory: inventory.map((i) => ({
      id: i.id,
      skuCode: i.skuCode,
      attributes: i.attributesJson,
      quantity: Number(i.quantity),
      lowStock: Number(i.quantity) <= threshold,
    })),
    topItems: topDetailed,
    storeSummary,
  });
}

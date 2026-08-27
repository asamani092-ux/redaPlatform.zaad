import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { requireActiveExhibition } from "@/lib/exhibition";
import { DEFAULT_INVENTORY_SCHEMA, parseInventorySchema } from "@/lib/inventory-schema";
import { fetchTopDispensedItems } from "@/lib/top-dispensed";
import { countDistinctReceived } from "@/lib/report-counts";
import { buildHouseholdMetrics } from "@/lib/report-metrics";
import { summarizePlatformStock, summarizeStoreStock } from "@/lib/store-ledger";
import { buildExhibitionKpiSections } from "@/lib/exhibition-kpis";

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
    dependentsRows,
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
    exhibitionKpis,
  ] = await Promise.all([
    prisma.beneficiary.findMany({ select: { dependentsCount: true } }),
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
    buildExhibitionKpiSections(exhibitionId),
  ]);

  const households = buildHouseholdMetrics(
    dependentsRows.map((r) => r.dependentsCount ?? 0),
  );

  const remainingToReceive = Math.max(attended - received, 0);
  const piecesDispensed = piecesAgg._sum.piecesCount ?? 0;
  // نسبة الإنجاز = المستلمون ÷ الحاضرون (الاستثنائي يدخل الطرفين) بسقف 100% — O(1)
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
      /** توافق خلفي: كان يُعرض كـ«مستفيدين» وهو عدد الأسر */
      totalBeneficiaries: households.beneficiaryFamilies,
      beneficiaryFamilies: households.beneficiaryFamilies,
      totalIndividuals: households.totalIndividuals,
      invited,
      attended,
      received,
      remainingToReceive,
      piecesDispensed,
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
      volunteers: exhibitionKpis.volunteers.count,
    },
    exhibitionKpis,
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

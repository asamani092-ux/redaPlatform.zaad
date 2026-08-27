import { prisma } from "@/lib/prisma";
import { countDistinctReceived } from "@/lib/report-counts";
import { buildExhibitionKpiSections } from "@/lib/exhibition-kpis";
import { buildBreakdownShares } from "@/lib/report-metrics";
import {
  attributeLabelsFromSchema,
  parseInventorySchema,
} from "@/lib/inventory-schema";

/** مؤشرات العرض الحي بلا PII — O(n) للمستفيدين + تجميعات المعرض */
export async function buildLiveMetrics(exhibitionId: string) {
  const exhibition = await prisma.exhibition.findUnique({
    where: { id: exhibitionId },
    select: {
      id: true,
      name: true,
      location: true,
      active: true,
      settings: { select: { inventorySchemaJson: true } },
    },
  });
  if (!exhibition) return null;

  const [attended, received, beneficiaries, exhibitionKpis] = await Promise.all([
    prisma.attendance.count({ where: { exhibitionId } }),
    countDistinctReceived(exhibitionId),
    prisma.beneficiary.findMany({
      select: {
        dependentsCount: true,
        neighborhood: true,
        city: true,
        gender: true,
        associationOther: true,
        association: { select: { name: true } },
      },
    }),
    buildExhibitionKpiSections(exhibitionId),
  ]);
  const completionRate =
    attended > 0 ? Math.min(100, Math.round((received / attended) * 100)) : 0;

  const breakdowns = buildBreakdownShares({
    associations: beneficiaries.map(
      (b) => b.association?.name ?? b.associationOther ?? "",
    ),
    neighborhoods: beneficiaries.map((b) => b.neighborhood ?? ""),
    cities: beneficiaries.map((b) => b.city ?? ""),
    genders: beneficiaries.map((b) =>
      b.gender === "MALE" ? "ذكر" : b.gender === "FEMALE" ? "أنثى" : "",
    ),
    dependentsCounts: beneficiaries.map((b) => b.dependentsCount),
  });

  const { settings, ...exhibitionPublic } = exhibition;

  return {
    exhibition: exhibitionPublic,
    updatedAt: new Date().toISOString(),
    stats: {
      completionRate,
    },
    exhibitionKpis,
    byAssociationShares: breakdowns.byAssociation,
    byNeighborhoodShares: breakdowns.byNeighborhood,
    byHouseholdSizeShares: breakdowns.households.byHouseholdSize,
    attributeLabels: attributeLabelsFromSchema(
      parseInventorySchema(settings?.inventorySchemaJson),
    ),
  };
}

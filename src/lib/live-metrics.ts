import { prisma } from "@/lib/prisma";
import { buildBreakdownShares, householdSize } from "@/lib/report-metrics";
import { fetchTopDispensedItems } from "@/lib/top-dispensed";
import { countDistinctReceived } from "@/lib/report-counts";
import {
  attributeLabelsFromSchema,
  parseInventorySchema,
} from "@/lib/inventory-schema";
import { sponsorLogoPublicUrl } from "@/lib/uploads";

/**
 * مؤشرات العرض الحي بلا PII — للشاشة العامة.
 * Time: O(a + d + b + s) حيث a حضور، d أسطر صرف، b مستفيدين، s داعمين.
 * Space: O(a + d + b + s).
 */
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

  const [
    totalBeneficiaries,
    invited,
    attended,
    received,
    piecesAgg,
    exceptions,
    beneficiaries,
    topItems,
    attendanceRows,
    dispenseLines,
    associationCount,
    sponsors,
  ] = await Promise.all([
    prisma.beneficiary.count(),
    prisma.exhibitionInvite.count({ where: { exhibitionId, invited: true } }),
    prisma.attendance.count({ where: { exhibitionId } }),
    countDistinctReceived(exhibitionId),
    prisma.dispenseOrder.aggregate({
      where: { exhibitionId },
      _sum: { piecesCount: true },
    }),
    prisma.attendance.count({ where: { exhibitionId, type: "EXCEPTION" } }),
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
    fetchTopDispensedItems(exhibitionId, 5),
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

  let attendedIndividuals = 0;
  let associationAttendedFamilies = 0;
  for (const row of attendanceRows) {
    attendedIndividuals += householdSize(row.beneficiary?.dependentsCount ?? 0);
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
      totalBeneficiaries,
      invited,
      attended,
      received,
      remainingToReceive: Math.max(attended - received, 0),
      piecesDispensed: piecesAgg._sum.piecesCount ?? 0,
      exceptions,
      completionRate,
      /** توافق خلفي */
      beneficiaryFamilies: attendedFamilies,
      totalIndividuals: attendedIndividuals,
      attendedFamilies,
      attendedIndividuals,
      clothesPiecesDispensed,
      fabricMetersDispensed,
      associationCount,
      associationAttendedFamilies,
    },
    sponsors: sponsors.map((s) => ({
      id: s.id,
      name: s.name,
      logoUrl: sponsorLogoPublicUrl(s.logoPath),
    })),
    byAssociationShares: breakdowns.byAssociation,
    byNeighborhoodShares: breakdowns.byNeighborhood,
    byHouseholdSizeShares: breakdowns.households.byHouseholdSize,
    topItems,
    attributeLabels: attributeLabelsFromSchema(
      parseInventorySchema(settings?.inventorySchemaJson),
    ),
  };
}

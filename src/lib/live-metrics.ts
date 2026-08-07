import { prisma } from "@/lib/prisma";
import { buildBreakdownShares } from "@/lib/report-metrics";
import { fetchTopDispensedItems } from "@/lib/top-dispensed";
import { countDistinctReceived } from "@/lib/report-counts";

/** مؤشرات العرض الحي بلا PII — O(n) للمستفيدين + تجميعات المعرض */
export async function buildLiveMetrics(exhibitionId: string) {
  const exhibition = await prisma.exhibition.findUnique({
    where: { id: exhibitionId },
    select: { id: true, name: true, location: true, active: true },
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

  return {
    exhibition,
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
      beneficiaryFamilies: breakdowns.households.beneficiaryFamilies,
      totalIndividuals: breakdowns.households.totalIndividuals,
    },
    byAssociationShares: breakdowns.byAssociation,
    byNeighborhoodShares: breakdowns.byNeighborhood,
    byHouseholdSizeShares: breakdowns.households.byHouseholdSize,
    topItems,
  };
}

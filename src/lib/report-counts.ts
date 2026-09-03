import { prisma } from "@/lib/prisma";

/**
 * عدد المستفيدين المميّزين الذين لديهم صرف في المعرض (اختياريًا ضمن يوم).
 * Time: O(1) على الفهرس؛ Space: O(1).
 */
export async function countDistinctReceived(
  exhibitionId: string,
  opts?: { dayStart?: Date; dayEnd?: Date },
): Promise<number> {
  if (opts?.dayStart && opts?.dayEnd) {
    const rows = await prisma.$queryRaw<Array<{ c: bigint | number }>>`
      SELECT COUNT(DISTINCT "beneficiaryId") AS c
      FROM "DispenseOrder"
      WHERE "exhibitionId" = ${exhibitionId}
        AND "createdAt" >= ${opts.dayStart}
        AND "createdAt" < ${opts.dayEnd}
    `;
    return Number(rows[0]?.c ?? 0);
  }
  const rows = await prisma.$queryRaw<Array<{ c: bigint | number }>>`
    SELECT COUNT(DISTINCT "beneficiaryId") AS c
    FROM "DispenseOrder"
    WHERE "exhibitionId" = ${exhibitionId}
  `;
  return Number(rows[0]?.c ?? 0);
}

/**
 * إجمالي القطع السابقة وعدد أوامر الصرف لمستفيد في معرض.
 * Time: O(1) تجميع؛ Space: O(1).
 */
export async function priorDispenseStats(
  exhibitionId: string,
  beneficiaryId: string,
): Promise<{ count: number; previousPiecesTotal: number }> {
  const agg = await prisma.dispenseOrder.aggregate({
    where: { exhibitionId, beneficiaryId },
    _count: { _all: true },
    _sum: { piecesCount: true },
  });
  return {
    count: agg._count._all,
    previousPiecesTotal: agg._sum.piecesCount ?? 0,
  };
}

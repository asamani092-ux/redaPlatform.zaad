import { prisma } from "@/lib/prisma";
import type { TopDispensedItem } from "@/lib/report-metrics";

/** أعلى N أصناف مصروفة للمعرض — O(n log n) عبر groupBy */
export async function fetchTopDispensedItems(
  exhibitionId: string,
  take = 5,
  opts?: { dayStart?: Date; dayEnd?: Date },
): Promise<TopDispensedItem[]> {
  const createdAt =
    opts?.dayStart && opts?.dayEnd
      ? { gte: opts.dayStart, lt: opts.dayEnd }
      : undefined;

  const topItems = await prisma.dispenseLine.groupBy({
    by: ["inventoryItemId"],
    where: {
      dispenseOrder: {
        exhibitionId,
        ...(createdAt ? { createdAt } : {}),
      },
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take,
  });

  if (!topItems.length) return [];

  const ids = topItems.map((t) => t.inventoryItemId);
  const items = await prisma.inventoryItem.findMany({
    where: { id: { in: ids } },
    select: { id: true, attributesJson: true },
  });
  const byId = new Map(items.map((i) => [i.id, i]));

  return topItems.map((t) => ({
    inventoryItemId: t.inventoryItemId,
    quantity: Number(t._sum.quantity ?? 0),
    attributes: (byId.get(t.inventoryItemId)?.attributesJson ?? {}) as Record<
      string,
      unknown
    >,
  }));
}

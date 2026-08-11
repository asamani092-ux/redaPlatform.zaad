import { Prisma } from "@/generated/prisma/client";
import { StockMovementType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * أرصدة المتاجر لصنف واحد من الحركات — O(m) حيث m عدد الحركات.
 * المتبقي = ADD(+RETURN) − DISPENSE(−REMOVE المنسوب للمتجر).
 */
export async function storeRemainingByStore(
  tx: Db,
  inventoryItemId: string,
): Promise<Map<string, number>> {
  const movements = await tx.stockMovement.findMany({
    where: { inventoryItemId, storeId: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { storeId: true, type: true, quantity: true, createdAt: true },
  });
  const bal = new Map<string, number>();
  for (const m of movements) {
    if (!m.storeId) continue;
    const q = Number(m.quantity);
    const cur = bal.get(m.storeId) ?? 0;
    if (m.type === StockMovementType.ADD || m.type === StockMovementType.RETURN) {
      bal.set(m.storeId, cur + q);
    } else if (m.type === StockMovementType.DISPENSE || m.type === StockMovementType.REMOVE) {
      bal.set(m.storeId, cur - q);
    }
  }
  return bal;
}

/**
 * ترتيب FIFO للمتاجر ذات رصيد موجب حسب أول ADD.
 * Time: O(m).
 */
export async function storeFifoOrder(
  tx: Db,
  inventoryItemId: string,
): Promise<Array<{ storeId: string; remaining: number }>> {
  const bal = await storeRemainingByStore(tx, inventoryItemId);
  const firstAdd = await tx.stockMovement.findMany({
    where: {
      inventoryItemId,
      storeId: { not: null },
      type: StockMovementType.ADD,
    },
    orderBy: { createdAt: "asc" },
    select: { storeId: true },
  });
  const seen = new Set<string>();
  const order: Array<{ storeId: string; remaining: number }> = [];
  for (const row of firstAdd) {
    if (!row.storeId || seen.has(row.storeId)) continue;
    seen.add(row.storeId);
    const rem = bal.get(row.storeId) ?? 0;
    if (rem > 0) order.push({ storeId: row.storeId, remaining: rem });
  }
  return order;
}

/**
 * يخصم كمية صرف من أرصدة المتاجر FIFO ويُنشئ حركات DISPENSE منسوبة.
 * ما تبقى بلا متجر يُسجَّل كحركة بدون storeId (مصدر المنصة).
 * Time: O(m + k) حيث k عدد المتاجر المخصومة.
 */
export async function createDispenseMovementsFifo(params: {
  tx: Db;
  exhibitionId: string;
  inventoryItemId: string;
  quantity: number;
  createdById: string;
  note: string;
}): Promise<void> {
  const { tx, exhibitionId, inventoryItemId, quantity, createdById, note } = params;
  let left = quantity;
  const fifo = await storeFifoOrder(tx, inventoryItemId);

  for (const lot of fifo) {
    if (left <= 0) break;
    const take = Math.min(lot.remaining, left);
    if (take <= 0) continue;
    await tx.stockMovement.create({
      data: {
        exhibitionId,
        inventoryItemId,
        type: StockMovementType.DISPENSE,
        quantity: new Prisma.Decimal(take),
        storeId: lot.storeId,
        createdById,
        note,
      },
    });
    left -= take;
  }

  if (left > 0) {
    await tx.stockMovement.create({
      data: {
        exhibitionId,
        inventoryItemId,
        type: StockMovementType.DISPENSE,
        quantity: new Prisma.Decimal(left),
        createdById,
        note,
      },
    });
  }
}

export type StoreItemSummary = {
  storeId: string;
  storeName: string;
  inventoryItemId: string;
  skuCode: string;
  attributes: Record<string, unknown>;
  added: number;
  dispensed: number;
  returned: number;
  removed: number;
  remaining: number;
};

/** تجميع حصر المتاجر للمعرض — O(m). */
export async function summarizeStoreStock(
  tx: Db,
  exhibitionId: string,
  opts?: { storeId?: string; dayStart?: Date; dayEnd?: Date },
): Promise<StoreItemSummary[]> {
  const storeFilter = opts?.storeId ? { storeId: opts.storeId } : { storeId: { not: null as string | null } };
  const dateFilter =
    opts?.dayStart && opts?.dayEnd
      ? { createdAt: { gte: opts.dayStart, lt: opts.dayEnd } }
      : {};

  const movements = await tx.stockMovement.findMany({
    where: {
      exhibitionId,
      ...storeFilter,
      ...dateFilter,
    },
    include: {
      store: { select: { id: true, name: true } },
      inventoryItem: { select: { id: true, skuCode: true, attributesJson: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const map = new Map<string, StoreItemSummary>();
  for (const m of movements) {
    if (!m.storeId || !m.store) continue;
    const key = `${m.storeId}:${m.inventoryItemId}`;
    let row = map.get(key);
    if (!row) {
      row = {
        storeId: m.storeId,
        storeName: m.store.name,
        inventoryItemId: m.inventoryItemId,
        skuCode: m.inventoryItem.skuCode,
        attributes: m.inventoryItem.attributesJson as Record<string, unknown>,
        added: 0,
        dispensed: 0,
        returned: 0,
        removed: 0,
        remaining: 0,
      };
      map.set(key, row);
    }
    const q = Number(m.quantity);
    if (m.type === StockMovementType.ADD) row.added += q;
    else if (m.type === StockMovementType.DISPENSE) row.dispensed += q;
    else if (m.type === StockMovementType.RETURN) row.returned += q;
    else if (m.type === StockMovementType.REMOVE) row.removed += q;
  }

  for (const row of map.values()) {
    row.remaining = row.added + row.returned - row.dispensed - row.removed;
  }
  return [...map.values()];
}

export type PlatformStockTotals = {
  added: number;
  dispensed: number;
  returned: number;
  removed: number;
  remaining: number;
};

/**
 * حصر حركات المنصة (بدون storeId) — مقابل حصر المتاجر.
 * Time: O(m) — Space: O(1).
 */
export async function summarizePlatformStock(
  tx: Db,
  exhibitionId: string,
): Promise<PlatformStockTotals> {
  const movements = await tx.stockMovement.findMany({
    where: { exhibitionId, storeId: null },
    select: { type: true, quantity: true },
  });
  const totals: PlatformStockTotals = {
    added: 0,
    dispensed: 0,
    returned: 0,
    removed: 0,
    remaining: 0,
  };
  for (const m of movements) {
    const q = Number(m.quantity);
    if (m.type === StockMovementType.ADD) totals.added += q;
    else if (m.type === StockMovementType.DISPENSE) totals.dispensed += q;
    else if (m.type === StockMovementType.RETURN) totals.returned += q;
    else if (m.type === StockMovementType.REMOVE) totals.removed += q;
  }
  totals.remaining = totals.added + totals.returned - totals.dispensed - totals.removed;
  return totals;
}

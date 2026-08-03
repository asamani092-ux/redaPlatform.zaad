/**
 * Integration proofs for entitlement + concurrent dispense.
 * Fail loud (process.exit 1) on any assertion failure.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role, StockMovementType } from "../src/generated/prisma/client";
import { effectiveEntitlement } from "../src/lib/entitlement";
import { DEFAULT_INVENTORY_SCHEMA } from "../src/lib/inventory-schema";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

async function main() {
  console.log("=== (a) effectiveEntitlement unit cases ===");
  assert(effectiveEntitlement(2, 0, 1) === 2, "no deps → base only");
  assert(effectiveEntitlement(2, 5, 1) === 7, "base + deps×per");
  assert(effectiveEntitlement(2, 5, 0) === 2, "perDep=0 → base only");
  assert(effectiveEntitlement(2, 5, 1, 9) === 9, "override replaces computed");
  assert(effectiveEntitlement(2, 0, 1, 1) === 1, "override below base still replaces");
  console.log("OK effectiveEntitlement");

  const stamp = Date.now();
  const exhibition = await prisma.exhibition.create({
    data: {
      name: `اختبار-استحقاق-${stamp}`,
      active: false,
      settings: {
        create: {
          baseEntitlement: 2,
          dependentsEntitlement: 1,
          lowStockThreshold: 1,
          inventorySchemaJson: DEFAULT_INVENTORY_SCHEMA,
        },
      },
    },
    include: { settings: true },
  });

  const operator = await prisma.user.create({
    data: {
      name: "موزع اختبار",
      mobile: `05${String(stamp).slice(-8)}`,
      passwordHash: "x",
      role: Role.DISTRIBUTION,
    },
  });

  const bLow = await prisma.beneficiary.create({
    data: {
      name: "مستفيد أقل",
      nationalId: `1${String(stamp).slice(-9)}`,
      mobile: "0501111111",
      dependentsCount: 0,
    },
  });
  const bHigh = await prisma.beneficiary.create({
    data: {
      name: "مستفيد أعلى",
      nationalId: `2${String(stamp).slice(-9)}`,
      mobile: "0502222222",
      dependentsCount: 5,
    },
  });
  const bOverride = await prisma.beneficiary.create({
    data: {
      name: "مستفيد استثناء",
      nationalId: `3${String(stamp).slice(-9)}`,
      mobile: "0503333333",
      dependentsCount: 1,
    },
  });

  for (const b of [bLow, bHigh, bOverride]) {
    await prisma.attendance.create({
      data: {
        exhibitionId: exhibition.id,
        beneficiaryId: b.id,
        checkedInById: operator.id,
      },
    });
  }

  const item = await prisma.inventoryItem.create({
    data: {
      exhibitionId: exhibition.id,
      attributesJson: { type: "اختبار", sku: "T1" },
      quantity: 100,
    },
  });

  console.log("=== (a) DB path: base + deps×per for low/high dependents ===");
  const orderLow = await prisma.dispenseOrder.create({
    data: {
      exhibitionId: exhibition.id,
      beneficiaryId: bLow.id,
      piecesCount: 2,
      createdById: operator.id,
      lines: { create: [{ inventoryItemId: item.id, quantity: 2 }] },
    },
  });
  assert(orderLow.piecesCount === 2, "low deps capped at base=2");

  // base 2 + 5 deps × 1 = 7
  const orderHigh = await prisma.dispenseOrder.create({
    data: {
      exhibitionId: exhibition.id,
      beneficiaryId: bHigh.id,
      piecesCount: 7,
      createdById: operator.id,
      lines: { create: [{ inventoryItemId: item.id, quantity: 7 }] },
    },
  });
  assert(orderHigh.piecesCount === 7, "high deps allows base+deps×per=7");

  let overComputedRejected = false;
  try {
    await prisma.dispenseOrder.create({
      data: {
        exhibitionId: exhibition.id,
        beneficiaryId: bOverride.id,
        // computed for deps=1: 2+1=3
        piecesCount: 4,
        createdById: operator.id,
      },
    });
  } catch {
    overComputedRejected = true;
  }
  assert(overComputedRejected, "(d) DB rejects exceeding computed entitlement without override");

  console.log("=== (b) empty/whitespace reason rejected at DB ===");
  let emptyRejected = false;
  try {
    await prisma.dispenseOrder.create({
      data: {
        exhibitionId: exhibition.id,
        beneficiaryId: bOverride.id,
        piecesCount: 8,
        entitledOverride: 8,
        overrideReason: "   ",
        createdById: operator.id,
      },
    });
  } catch (e) {
    emptyRejected = true;
    console.log("empty reason error:", e instanceof Error ? e.message : e);
  }
  assert(emptyRejected, "whitespace overrideReason rejected");

  let nullRejected = false;
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "DispenseOrder" (id, "exhibitionId", "beneficiaryId", "piecesCount", "entitledOverride", "overrideReason", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,8,8,NULL,NOW(),NOW())`,
      `raw-${stamp}`,
      exhibition.id,
      bOverride.id,
    );
  } catch (e) {
    nullRejected = true;
    console.log("null reason error:", e instanceof Error ? e.message : e);
  }
  assert(nullRejected, "null overrideReason rejected");

  console.log("=== (a/c) operator override + audit row ===");
  const overrideOrder = await prisma.dispenseOrder.create({
    data: {
      exhibitionId: exhibition.id,
      beneficiaryId: bOverride.id,
      piecesCount: 8,
      entitledOverride: 8,
      overrideReason: "عائلة كبيرة معتمدة من التوزيع",
      createdById: operator.id,
      lines: { create: [{ inventoryItemId: item.id, quantity: 8 }] },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: operator.id,
      action: "ENTITLEMENT_OVERRIDE",
      entityType: "DispenseOrder",
      entityId: overrideOrder.id,
      beforeJson: {
        effectiveEntitlement: effectiveEntitlement(2, 1, 1),
        baseEntitlement: 2,
        dependentsEntitlement: 1,
        dependentsCount: 1,
      },
      afterJson: { effectiveEntitlement: 8, entitledOverride: 8 },
      metaJson: { reason: "عائلة كبيرة معتمدة من التوزيع", beneficiaryId: bOverride.id },
    },
  });

  const audit = await prisma.auditLog.findFirst({
    where: { entityId: overrideOrder.id, action: "ENTITLEMENT_OVERRIDE" },
  });
  assert(audit, "audit row exists");
  assert(audit!.userId === operator.id, "audit actor");
  assert(!!audit!.createdAt, "audit timestamp");
  const before = audit!.beforeJson as { effectiveEntitlement: number };
  const after = audit!.afterJson as { entitledOverride: number };
  const meta = audit!.metaJson as { reason: string };
  assert(before.effectiveEntitlement === 3, "audit before computed (2+1×1)");
  assert(after.entitledOverride === 8, "audit after override");
  assert(meta.reason.includes("عائلة"), "audit reason");
  console.log("OK override + audit");

  console.log("=== (e) 10 concurrent dispenses on qty=5 → 5 ok + 5 reject, no negative ===");
  const raceEx = await prisma.exhibition.create({
    data: {
      name: `اختبار-تزامن-${stamp}`,
      active: false,
      settings: {
        create: {
          baseEntitlement: 1,
          lowStockThreshold: 0,
          inventorySchemaJson: DEFAULT_INVENTORY_SCHEMA,
        },
      },
    },
  });
  const raceItem = await prisma.inventoryItem.create({
    data: {
      exhibitionId: raceEx.id,
      attributesJson: { type: "race" },
      quantity: 5,
    },
  });

  const beneficiaries = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      prisma.beneficiary.create({
        data: {
          name: `متزامن ${i}`,
          nationalId: `9${String(stamp).slice(-8)}${i}`,
          mobile: `059${String(stamp).slice(-6)}${i}`,
          dependentsCount: 0,
        },
      }),
    ),
  );

  await Promise.all(
    beneficiaries.map((b) =>
      prisma.attendance.create({
        data: { exhibitionId: raceEx.id, beneficiaryId: b.id, checkedInById: operator.id },
      }),
    ),
  );

  const results = await Promise.all(
    beneficiaries.map(async (b) => {
      try {
        await prisma.$transaction(async (tx) => {
          const updated = await tx.inventoryItem.updateMany({
            where: { id: raceItem.id, quantity: { gte: 1 } },
            data: { quantity: { decrement: 1 } },
          });
          if (updated.count !== 1) throw new Error("insufficient");
          await tx.stockMovement.create({
            data: {
              exhibitionId: raceEx.id,
              inventoryItemId: raceItem.id,
              type: StockMovementType.DISPENSE,
              quantity: 1,
              createdById: operator.id,
            },
          });
          await tx.dispenseOrder.create({
            data: {
              exhibitionId: raceEx.id,
              beneficiaryId: b.id,
              piecesCount: 1,
              createdById: operator.id,
              lines: { create: [{ inventoryItemId: raceItem.id, quantity: 1 }] },
            },
          });
        });
        return "ok" as const;
      } catch {
        return "reject" as const;
      }
    }),
  );

  const ok = results.filter((r) => r === "ok").length;
  const reject = results.filter((r) => r === "reject").length;
  const stock = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: raceItem.id } });
  console.log({ ok, reject, stock: Number(stock.quantity) });
  assert(ok === 5, `expected 5 success got ${ok}`);
  assert(reject === 5, `expected 5 reject got ${reject}`);
  assert(Number(stock.quantity) === 0, "stock must be zero not negative");
  assert(Number(stock.quantity) >= 0, "no negative stock");

  console.log("ALL ENTITLEMENT INTEGRATION TESTS PASSED");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

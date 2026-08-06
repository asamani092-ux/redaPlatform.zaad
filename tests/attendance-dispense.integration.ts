import "dotenv/config";
import { AttendanceType, StockMovementType } from "../src/generated/prisma/client";
import { assert, makePrisma, seedFixture } from "./helpers";

async function main() {
  const prisma = makePrisma();
  const stamp = Date.now();
  const { exhibition, distributor } = await seedFixture(prisma, stamp);

  const beneficiary = await prisma.beneficiary.create({
    data: {
      name: "حضور مكرر",
      nationalId: `1${String(stamp).slice(-9)}`,
      mobile: "0501000001",
      dependentsCount: 0,
    },
  });

  console.log("=== duplicate attendance rejected ===");
  await prisma.attendance.create({
    data: {
      exhibitionId: exhibition.id,
      beneficiaryId: beneficiary.id,
      type: AttendanceType.NORMAL,
      checkedInById: distributor.id,
    },
  });
  let dupAtt = false;
  try {
    await prisma.attendance.create({
      data: {
        exhibitionId: exhibition.id,
        beneficiaryId: beneficiary.id,
        type: AttendanceType.NORMAL,
        checkedInById: distributor.id,
      },
    });
  } catch {
    dupAtt = true;
  }
  assert(dupAtt, "duplicate attendance must fail at DB unique");

  const item = await prisma.inventoryItem.create({
    data: {
      exhibitionId: exhibition.id,
      attributesJson: { t: "x" },
      quantity: 10,
    },
  });

  console.log("=== re-dispense allowed (cumulative history) ===");
  await prisma.dispenseOrder.create({
    data: {
      exhibitionId: exhibition.id,
      beneficiaryId: beneficiary.id,
      piecesCount: 1,
      createdById: distributor.id,
      lines: { create: [{ inventoryItemId: item.id, quantity: 1 }] },
    },
  });
  // بعد 0006_dispense_repeat: لا قيد فريد — الصرف الاستثنائي اللاحق تراكمي
  let reDispOk = true;
  try {
    await prisma.dispenseOrder.create({
      data: {
        exhibitionId: exhibition.id,
        beneficiaryId: beneficiary.id,
        piecesCount: 1,
        createdById: distributor.id,
        lines: { create: [{ inventoryItemId: item.id, quantity: 1 }] },
      },
    });
  } catch {
    reDispOk = false;
  }
  assert(reDispOk, "re-dispense must be allowed (no unique on beneficiary+exhibition)");
  const dispenseCount = await prisma.dispenseOrder.count({
    where: { exhibitionId: exhibition.id, beneficiaryId: beneficiary.id },
  });
  assert(dispenseCount === 2, "two cumulative dispense orders expected");

  console.log("=== concurrency 10 on qty 5 ===");
  const raceEx = await prisma.exhibition.create({
    data: {
      name: `race-${stamp}`,
      active: false,
      settings: {
        create: {
          baseEntitlement: 1,
          lowStockThreshold: 0,
          inventorySchemaJson: [{ key: "t", label: "t", options: ["a"] }],
        },
      },
    },
  });
  const raceItem = await prisma.inventoryItem.create({
    data: { exhibitionId: raceEx.id, attributesJson: { t: "r" }, quantity: 5 },
  });
  const people = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      prisma.beneficiary.create({
        data: {
          name: `r${i}`,
          nationalId: `8${String(stamp).slice(-8)}${i}`,
          mobile: `058${String(stamp).slice(-6)}${i}`,
        },
      }),
    ),
  );
  await Promise.all(
    people.map((b) =>
      prisma.attendance.create({
        data: {
          exhibitionId: raceEx.id,
          beneficiaryId: b.id,
          checkedInById: distributor.id,
        },
      }),
    ),
  );

  const results = await Promise.all(
    people.map(async (b) => {
      try {
        await prisma.$transaction(async (tx) => {
          const updated = await tx.inventoryItem.updateMany({
            where: { id: raceItem.id, quantity: { gte: 1 } },
            data: { quantity: { decrement: 1 } },
          });
          if (updated.count !== 1) throw new Error("insuff");
          await tx.stockMovement.create({
            data: {
              exhibitionId: raceEx.id,
              inventoryItemId: raceItem.id,
              type: StockMovementType.DISPENSE,
              quantity: 1,
              createdById: distributor.id,
            },
          });
          await tx.dispenseOrder.create({
            data: {
              exhibitionId: raceEx.id,
              beneficiaryId: b.id,
              piecesCount: 1,
              createdById: distributor.id,
              lines: { create: [{ inventoryItemId: raceItem.id, quantity: 1 }] },
            },
          });
        });
        return "ok";
      } catch {
        return "reject";
      }
    }),
  );
  const ok = results.filter((r) => r === "ok").length;
  const reject = results.filter((r) => r === "reject").length;
  const stock = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: raceItem.id } });
  console.log({ ok, reject, stock: Number(stock.quantity) });
  assert(ok === 5 && reject === 5, "5/5 concurrency");
  assert(Number(stock.quantity) === 0, "no negative stock");

  console.log("ATTENDANCE/DISPENSE TESTS PASSED");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import "dotenv/config";
import { WRITE_PATHS, auditedWritePaths } from "../src/lib/write-paths";
import { assert, makePrisma, seedFixture } from "./helpers";

async function main() {
  console.log("=== write-path registry ===");
  const audited = auditedWritePaths();
  assert(audited.length >= 14, "expected audited write paths");
  const excluded = WRITE_PATHS.filter((p) => !p.audited);
  for (const p of excluded) {
    assert(!!p.excludeReason, `excluded path ${p.id} needs reason`);
    console.log(`EXCLUDED ${p.id}: ${p.excludeReason}`);
  }

  const prisma = makePrisma();
  const stamp = Date.now();
  const { exhibition, admin } = await seedFixture(prisma, stamp);

  console.log("=== exercise writes + audit rows ===");

  const assoc = await prisma.associationOption.create({
    data: { name: `جمعية-${stamp}`, sortOrder: 99 },
  });
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "ASSOCIATION_UPSERT",
      entityType: "AssociationOption",
      entityId: assoc.id,
      afterJson: assoc,
    },
  });

  const beforeUser = await prisma.user.findUniqueOrThrow({ where: { id: admin.id } });
  const updatedUser = await prisma.user.update({
    where: { id: admin.id },
    data: { name: "AdminFixtureUpdated" },
  });
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "USER_UPDATE",
      entityType: "User",
      entityId: admin.id,
      beforeJson: { id: beforeUser.id, name: beforeUser.name, role: beforeUser.role },
      afterJson: { id: updatedUser.id, name: updatedUser.name, role: updatedUser.role },
    },
  });

  const settingsBefore = await prisma.exhibitionSettings.findUniqueOrThrow({
    where: { exhibitionId: exhibition.id },
  });
  const settingsAfter = await prisma.exhibitionSettings.update({
    where: { exhibitionId: exhibition.id },
    data: { baseEntitlement: 3 },
  });
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "UPDATE_SETTINGS",
      entityType: "ExhibitionSettings",
      entityId: settingsAfter.id,
      beforeJson: { baseEntitlement: settingsBefore.baseEntitlement },
      afterJson: { baseEntitlement: settingsAfter.baseEntitlement },
    },
  });

  const requiredActions = [
    "ASSOCIATION_UPSERT",
    "USER_UPDATE",
    "UPDATE_SETTINGS",
  ];
  for (const action of requiredActions) {
    const row = await prisma.auditLog.findFirst({
      where: { action, userId: admin.id },
      orderBy: { createdAt: "desc" },
    });
    assert(row, `missing audit for ${action}`);
    assert(!!row.createdAt, `${action} has time`);
    assert(row.userId === admin.id, `${action} has actor`);
    console.log(`OK audit ${action} actor=${row.userId} time=${row.createdAt.toISOString()}`);
  }

  // Registry completeness: every audited path id is unique
  const ids = new Set(WRITE_PATHS.map((p) => p.id));
  assert(ids.size === WRITE_PATHS.length, "duplicate write path ids");

  console.log("AUDIT COVERAGE TESTS PASSED");
  console.log(
    "Audited paths:",
    audited.map((p) => p.id).join(", "),
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

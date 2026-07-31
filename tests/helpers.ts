import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role } from "../src/generated/prisma/client";
import { DEFAULT_INVENTORY_SCHEMA } from "../src/lib/inventory-schema";

export function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

export function makePrisma() {
  if (!process.env.DATABASE_URL) {
    console.error("FAIL: DATABASE_URL required");
    process.exit(1);
  }
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export async function seedFixture(prisma: PrismaClient, stamp: number) {
  const exhibition = await prisma.exhibition.create({
    data: {
      name: `fixture-${stamp}`,
      active: false,
      settings: {
        create: {
          baseEntitlement: 2,
          lowStockThreshold: 1,
          inventorySchemaJson: DEFAULT_INVENTORY_SCHEMA,
        },
      },
    },
    include: { settings: true },
  });
  const admin = await prisma.user.create({
    data: {
      name: "AdminFixture",
      mobile: `05${String(stamp).slice(-8)}`,
      passwordHash: "x",
      role: Role.ADMIN,
    },
  });
  const distributor = await prisma.user.create({
    data: {
      name: "DistFixture",
      mobile: `06${String(stamp).slice(-8)}`,
      passwordHash: "x",
      role: Role.DISTRIBUTION,
    },
  });
  return { exhibition, admin, distributor };
}

import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  /** يتغيّر بعد prisma generate — لإبطال الـ singleton القديم */
  prismaFieldRev?: string;
};

/** بصمة حقول ExhibitionInvite — O(f log f) عند التحميل فقط */
const PRISMA_FIELD_REV = Object.keys(Prisma.ExhibitionInviteScalarFieldEnum)
  .sort()
  .join(",");

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

function getPrisma(): PrismaClient {
  if (
    globalForPrisma.prisma &&
    globalForPrisma.prismaFieldRev === PRISMA_FIELD_REV
  ) {
    return globalForPrisma.prisma;
  }
  const client = createPrismaClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
    globalForPrisma.prismaFieldRev = PRISMA_FIELD_REV;
  }
  return client;
}

export const prisma = getPrisma();

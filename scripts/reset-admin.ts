/** إعادة تعيين كلمة المدير يدوياً — يتطلب ADMIN_PASSWORD من البيئة. */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const mobile = (process.env.ADMIN_MOBILE ?? "0500000000").trim();
  const password = process.env.ADMIN_PASSWORD?.trim();
  if (!password) {
    throw new Error("ADMIN_PASSWORD مطلوب من البيئة");
  }
  const hash = await bcrypt.hash(password, 10);
  const updated = await prisma.user.updateMany({
    where: { mobile },
    data: { passwordHash: hash, active: true },
  });
  console.log("reset-admin:", { mobile, updated: updated.count });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

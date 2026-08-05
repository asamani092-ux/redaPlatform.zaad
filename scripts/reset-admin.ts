import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });
  const hash = await bcrypt.hash("Admin@1234", 10);
  const u = await prisma.user.update({
    where: { mobile: "0500000000" },
    data: { passwordHash: hash, active: true },
  });
  console.log("reset ok", u.mobile);
  await prisma.$disconnect();
}

main();

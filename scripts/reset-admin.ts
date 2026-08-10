/** إنشاء/إعادة تعيين كلمة المدير — يتطلب ADMIN_PASSWORD من البيئة. */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const mobile = (process.env.ADMIN_MOBILE ?? "0500000000").trim();
  const password = process.env.ADMIN_PASSWORD?.trim();
  if (!password) {
    throw new Error("ADMIN_PASSWORD مطلوب من البيئة");
  }
  const hash = await bcrypt.hash(password, 10);
  const existing = await prisma.user.findUnique({ where: { mobile } });
  if (!existing) {
    const created = await prisma.user.create({
      data: {
        mobile,
        name: "مدير النظام",
        role: Role.ADMIN,
        passwordHash: hash,
        active: true,
      },
    });
    console.log("reset-admin: created", { mobile: created.mobile, id: created.id });
    return;
  }
  const updated = await prisma.user.update({
    where: { mobile },
    data: { passwordHash: hash, active: true, role: Role.ADMIN },
  });
  console.log("reset-admin: updated", { mobile: updated.mobile, id: updated.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

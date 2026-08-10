/**
 * إنشاء/تحديث المدير من الحاوية.
 * الاستخدام:
 *   npx tsx scripts/ensure-admin.ts
 *   npx tsx scripts/ensure-admin.ts 0555143246 'كلمة-المرور'
 * Time/Space: O(1)
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role } from "../src/generated/prisma/client";

async function main() {
  const argMobile = process.argv[2]?.trim();
  const argPassword = process.argv[3]?.trim();
  const mobile = (argMobile || process.env.ADMIN_MOBILE || "0555143246").trim();
  const password = (argPassword || process.env.ADMIN_PASSWORD || "").trim();

  console.log("ensure-admin: diag", {
    databaseUrl: Boolean(process.env.DATABASE_URL),
    mobile,
    passwordSource: argPassword ? "argv" : process.env.ADMIN_PASSWORD ? "env" : "missing",
    passwordLength: password.length,
  });

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL غير مضبوط في بيئة الحاوية");
  }
  if (password.length < 4) {
    throw new Error(
      "كلمة المرور ناقصة — مرّرها: npx tsx scripts/ensure-admin.ts 0555143246 'كلمة-المرور'",
    );
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const users = await prisma.user.count();
    const hash = await bcrypt.hash(password, 10);
    const u = await prisma.user.upsert({
      where: { mobile },
      create: {
        mobile,
        name: "مدير النظام",
        role: Role.ADMIN,
        passwordHash: hash,
        active: true,
      },
      update: {
        passwordHash: hash,
        active: true,
        role: Role.ADMIN,
      },
    });
    console.log("ensure-admin: OK", {
      id: u.id,
      mobile: u.mobile,
      role: u.role,
      active: u.active,
      usersTotal: users,
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("ensure-admin: FAIL", e);
  process.exit(1);
});

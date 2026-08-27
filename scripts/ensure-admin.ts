/**
 * إنشاء/تحديث المدير من الحاوية.
 *   npx tsx scripts/ensure-admin.ts
 *   npx tsx scripts/ensure-admin.ts --if-empty
 *   npx tsx scripts/ensure-admin.ts 05xxxxxxxx 'كلمة-المرور'
 * Time: O(1)؛ Space: O(1).
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role } from "../src/generated/prisma/client";

const args = process.argv.slice(2);
const ifEmpty = args.includes("--if-empty");
const positional = args.filter((a) => a !== "--if-empty");

async function main() {
  const argMobile = positional[0]?.trim();
  const argPassword = positional[1]?.trim();
  const mobile = (argMobile || process.env.ADMIN_MOBILE || "0500000000").trim();
  const password = (argPassword || process.env.ADMIN_PASSWORD || "").trim();

  console.log("ensure-admin: diag", {
    mode: ifEmpty ? "if-empty" : "upsert",
    databaseUrl: Boolean(process.env.DATABASE_URL),
    mobile,
    passwordSource: argPassword ? "argv" : process.env.ADMIN_PASSWORD ? "env" : "missing",
    passwordLength: password.length,
  });

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL غير مضبوط في بيئة الحاوية");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const usersTotal = await prisma.user.count();

    if (ifEmpty) {
      if (usersTotal > 0) {
        console.log("ensure-admin: skip — users exist", { usersTotal });
        return;
      }
      if (password.length < 4) {
        throw new Error(
          "قاعدة فارغة — عيّن ADMIN_PASSWORD في البيئة أو مرّر كلمة المرور كمعامل",
        );
      }
      const hash = await bcrypt.hash(password, 10);
      const created = await prisma.user.create({
        data: {
          mobile,
          name: "مدير النظام",
          role: Role.ADMIN,
          passwordHash: hash,
          active: true,
        },
      });
      console.log("ensure-admin: created (empty db)", {
        id: created.id,
        mobile: created.mobile,
        usersTotal: 1,
      });
      return;
    }

    if (password.length < 4) {
      throw new Error(
        "كلمة المرور ناقصة — مرّرها: npx tsx scripts/ensure-admin.ts 05xxxxxxxx 'كلمة-المرور'",
      );
    }

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
      usersTotal,
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("ensure-admin: FAIL", e);
  process.exit(1);
});

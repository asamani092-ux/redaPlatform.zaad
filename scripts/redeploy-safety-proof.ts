/**
 * إثبات أمان إعادة النشر على قاعدة scratch.
 * (1) migrate + init (2) تغيير كلمة المدير + مستفيد (3) apply-pending + init ثانية
 * (4) إثبات بقاء كلمة المرور الجديدة وعدد المستفيدين.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { execSync } from "child_process";

function pgUrl(dbName?: string): string {
  const u = new URL(process.env.DATABASE_URL!);
  u.search = "";
  if (dbName) u.pathname = `/${dbName}`;
  return u.toString();
}

function run(cmd: string, env: NodeJS.ProcessEnv) {
  execSync(cmd, { stdio: "inherit", env: { ...process.env, ...env }, cwd: process.cwd() });
}

async function main() {
  const scratch = "ridaa_redeploy_safety";
  const adminUrl = pgUrl("postgres");
  const scratchUrl = pgUrl(scratch);
  const scratchDbUrl = `${scratchUrl}?schema=public`;

  execSync(
    `psql "${adminUrl}" -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${scratch}' AND pid <> pg_backend_pid();" >/dev/null 2>&1 || true`,
    { shell: "/bin/bash" },
  );
  execSync(`psql "${adminUrl}" -v ON_ERROR_STOP=1 -c 'DROP DATABASE IF EXISTS "${scratch}";'`, {
    stdio: "inherit",
  });
  execSync(`psql "${adminUrl}" -v ON_ERROR_STOP=1 -c 'CREATE DATABASE "${scratch}";'`, {
    stdio: "inherit",
  });

  const initPass = "InitPass-Once-Only!";
  const changedPass = "ChangedAfterInit-Safe!";
  const envBase = {
    DATABASE_URL: scratchDbUrl,
    ADMIN_MOBILE: "0500000000",
    ADMIN_PASSWORD: initPass,
  };

  run("./scripts/apply-pending.sh", envBase);
  run("npm run init", envBase);

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: scratchDbUrl }),
  });

  const admin0 = await prisma.user.findUniqueOrThrow({ where: { mobile: "0500000000" } });
  const newHash = await bcrypt.hash(changedPass, 10);
  await prisma.user.update({
    where: { id: admin0.id },
    data: { passwordHash: newHash },
  });
  await prisma.beneficiary.create({
    data: {
      name: "مستفيد إثبات",
      nationalId: "1999888777",
      mobile: "0599999999",
    },
  });

  const mid = await prisma.user.findUniqueOrThrow({ where: { mobile: "0500000000" } });
  const countMid = await prisma.beneficiary.count();
  const before = {
    adminHashPrefix: mid.passwordHash.slice(0, 20),
    beneficiaryCount: countMid,
    changedPasswordValid: await bcrypt.compare(changedPass, mid.passwordHash),
    initPasswordValid: await bcrypt.compare(initPass, mid.passwordHash),
  };
  console.log("BEFORE_SECOND_BOOT", JSON.stringify(before, null, 2));

  await prisma.$disconnect();

  // boot sequence second time (no seed in Dockerfile; also re-run init to prove NO-OP)
  run("./scripts/apply-pending.sh", envBase);
  run("npm run init", envBase);

  const prisma2 = new PrismaClient({
    adapter: new PrismaPg({ connectionString: scratchDbUrl }),
  });
  const admin1 = await prisma2.user.findUniqueOrThrow({ where: { mobile: "0500000000" } });
  const countAfter = await prisma2.beneficiary.count();
  const after = {
    adminHashPrefix: admin1.passwordHash.slice(0, 20),
    beneficiaryCount: countAfter,
    changedPasswordStillValid: await bcrypt.compare(changedPass, admin1.passwordHash),
    initPasswordReverted: await bcrypt.compare(initPass, admin1.passwordHash),
  };
  console.log("AFTER_SECOND_BOOT", JSON.stringify(after, null, 2));

  if (
    !after.changedPasswordStillValid ||
    after.initPasswordReverted ||
    after.beneficiaryCount !== before.beneficiaryCount ||
    admin1.passwordHash !== mid.passwordHash
  ) {
    console.error("REDEPLOY-SAFETY FAIL");
    process.exit(1);
  }
  console.log("REDEPLOY-SAFETY PASS");
  await prisma2.$disconnect();

  execSync(`psql "${adminUrl}" -v ON_ERROR_STOP=1 -c 'DROP DATABASE IF EXISTS "${scratch}";'`, {
    stdio: "inherit",
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

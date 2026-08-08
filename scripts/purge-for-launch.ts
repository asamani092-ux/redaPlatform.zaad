/**
 * تنظيف قاعدة التشغيل قبل الإطلاق:
 * يحذف بيانات التجربة وكل المستخدمين عدا مشرف النظام (ADMIN_MOBILE).
 * يتطلب CONFIRM_PURGE=YES_LAUNCH — Time: O(n) حذف؛ Space: O(1).
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role } from "../src/generated/prisma/client";
import { DEFAULT_INVENTORY_SCHEMA } from "../src/lib/inventory-schema";

if (process.env.CONFIRM_PURGE !== "YES_LAUNCH") {
  console.error("ارفض التنفيذ: عيّن CONFIRM_PURGE=YES_LAUNCH");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const mobile = (process.env.ADMIN_MOBILE ?? "0500000000").trim();
  const password = process.env.ADMIN_PASSWORD?.trim();
  if (!password) {
    throw new Error("ADMIN_PASSWORD مطلوب من البيئة — لا افتراضي");
  }
  const passwordHash = await bcrypt.hash(password, 10);

  console.log("purge: starting — keep admin mobile =", mobile);

  await prisma.$transaction(async (tx) => {
    await tx.dispenseLine.deleteMany();
    await tx.dispenseOrder.deleteMany();
    await tx.stockMovement.deleteMany();
    await tx.inventoryItem.deleteMany();
    await tx.attendance.deleteMany();
    await tx.exhibitionInvite.deleteMany();
    await tx.surveyResponse.deleteMany();
    await tx.outboundMessage.deleteMany();
    await tx.liveDisplayLink.deleteMany();
    await tx.auditLog.deleteMany();
    await tx.passwordReset.deleteMany();
    await tx.exhibitionSettings.deleteMany();
    await tx.exhibition.deleteMany();
    await tx.beneficiary.deleteMany();
    await tx.associationOption.deleteMany();

    await tx.user.deleteMany({
      where: { mobile: { not: mobile } },
    });

    await tx.user.upsert({
      where: { mobile },
      update: {
        name: "مدير النظام",
        role: Role.ADMIN,
        passwordHash,
        active: true,
      },
      create: {
        mobile,
        name: "مدير النظام",
        role: Role.ADMIN,
        passwordHash,
      },
    });

    await tx.appConfig.upsert({
      where: { id: "app" },
      update: {
        whatsappProvider: process.env.WHATSAPP_PROVIDER ?? "stub",
      },
      create: {
        id: "app",
        whatsappProvider: process.env.WHATSAPP_PROVIDER ?? "stub",
      },
    });

    const associations = ["جمعية الزاد", "جمعية البر", "جمعية الإحسان"];
    for (const [i, name] of associations.entries()) {
      await tx.associationOption.create({
        data: { name, sortOrder: i, active: true },
      });
    }

    await tx.exhibition.create({
      data: {
        name: "معرض رداء الأول",
        location: "يُحدد لاحقاً",
        startsAt: new Date(),
        active: true,
        settings: {
          create: {
            baseEntitlement: 2,
            dependentsEntitlement: 1,
            lowStockThreshold: 10,
            inventorySchemaJson: DEFAULT_INVENTORY_SCHEMA,
            whatsappInviteTpl:
              "مرحباً {{name}}، أنت مدعو إلى {{exhibition}}. الموعد: {{date}} — الموقع: {{location}}",
            whatsappThanksTpl: "شكراً لزيارتك {{exhibition}}، {{name}}.",
            surveyQuestionsJson: [
              {
                id: "q1",
                text: "كيف تقيّم تجربة الزيارة؟",
                type: "scale",
                min: 1,
                max: 5,
              },
              { id: "q2", text: "ملاحظات إضافية", type: "text" },
            ],
          },
        },
      },
    });
  });

  const users = await prisma.user.findMany({
    select: { name: true, mobile: true, role: true },
  });
  const counts = {
    users: await prisma.user.count(),
    beneficiaries: await prisma.beneficiary.count(),
    exhibitions: await prisma.exhibition.count(),
    attendance: await prisma.attendance.count(),
    dispense: await prisma.dispenseOrder.count(),
  };
  console.log("purge: done", { users, counts });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role } from "../src/generated/prisma/client";
import { DEFAULT_INVENTORY_SCHEMA } from "../src/lib/inventory-schema";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

/**
 * تهيئة لمرة واحدة فقط (`npm run init`).
 * إعادة التشغيل على قاعدة مأهولة = NO-OP للمستخدم/الإعدادات الموجودة.
 * Time: O(1) فحوصات + إنشاء عند الغياب؛ Space: O(1).
 */
async function main() {
  const mobile = (process.env.ADMIN_MOBILE ?? "0500000000").trim();
  const password = process.env.ADMIN_PASSWORD?.trim();
  if (!password) {
    throw new Error(
      "ADMIN_PASSWORD مطلوب من البيئة لـ npm run init — لا توجد كلمة مرور افتراضية في المستودع",
    );
  }

  let admin = await prisma.user.findUnique({ where: { mobile } });
  if (!admin) {
    const passwordHash = await bcrypt.hash(password, 10);
    admin = await prisma.user.create({
      data: {
        mobile,
        name: "مدير النظام",
        role: Role.ADMIN,
        passwordHash,
        active: true,
      },
    });
    console.log("seed: created admin", admin.mobile);
  } else {
    // لا تُكتب passwordHash / name / role / active أبداً إن وُجد المدير
    console.log("seed: admin exists — skip (no mutation)");
  }

  const associations = ["جمعية الزاد", "جمعية البر", "جمعية الإحسان"];
  for (const [i, name] of associations.entries()) {
    const existing = await prisma.associationOption.findUnique({ where: { name } });
    if (!existing) {
      await prisma.associationOption.create({
        data: { name, sortOrder: i, active: true },
      });
    }
  }

  const volunteerRoles = [
    "التواصل مع الجهات",
    "فرز الملابس",
    "ترتيب المعرض",
    "تنظيم الأسر",
    "استقبال الأسر",
    "حصر الأسر",
    "مساعدة الأسر",
    "الضيافة",
  ];
  for (const [i, name] of volunteerRoles.entries()) {
    await prisma.volunteerRoleOption.upsert({
      where: { name },
      update: { active: true, sortOrder: i },
      create: { name, sortOrder: i },
    });
  }

  let exhibition = await prisma.exhibition.findFirst({ where: { active: true } });
  if (!exhibition) {
    exhibition = await prisma.exhibition.findFirst({ where: { name: "معرض رداء الأول" } });
  }
  if (!exhibition) {
    exhibition = await prisma.exhibition.create({
      data: {
        name: "معرض رداء الأول",
        location: "يُحدد لاحقاً",
        startsAt: new Date(),
        active: true,
        settings: {
          create: {
            baseEntitlement: 2,
            lowStockThreshold: 10,
            inventorySchemaJson: DEFAULT_INVENTORY_SCHEMA,
            whatsappInviteTpl:
              "مرحباً {{name}}، أنت مدعو إلى {{exhibition}}. الموعد: {{date}} — الموقع: {{location}}",
            whatsappThanksTpl: "شكراً لزيارتك {{exhibition}}، {{name}}.",
            surveyQuestionsJson: [
              { id: "q1", text: "كيف تقيّم تجربة الزيارة؟", type: "scale", min: 1, max: 5 },
              { id: "q2", text: "ملاحظات إضافية", type: "text" },
            ],
          },
        },
      },
    });
    console.log("seed: created exhibition", exhibition.name);
  }

  // ترقية مخطط المخزون: opt-in صريح فقط — وإلا لا مساس بالإعدادات الموجودة
  if (process.env.SEED_MIGRATE_SCHEMA === "1") {
    const settings = await prisma.exhibitionSettings.findUnique({
      where: { exhibitionId: exhibition.id },
    });
    if (settings) {
      const raw = settings.inventorySchemaJson as Array<Record<string, unknown>>;
      if (Array.isArray(raw) && raw.some((r) => !Array.isArray(r.options))) {
        await prisma.exhibitionSettings.update({
          where: { id: settings.id },
          data: { inventorySchemaJson: DEFAULT_INVENTORY_SCHEMA },
        });
        console.log("seed: SEED_MIGRATE_SCHEMA=1 — inventory schema upgraded");
      }
    }
  }

  const sampleId = "1100000007";
  const sample = await prisma.beneficiary.findUnique({ where: { nationalId: sampleId } });
  if (!sample) {
    await prisma.beneficiary.create({
      data: {
        name: "مستفيد تجريبي",
        nationalId: sampleId,
        mobile: "0555555555",
        gender: "MALE",
        city: "الرياض",
        neighborhood: "النرجس",
        associationOther: null,
        associationId: (
          await prisma.associationOption.findFirst({ where: { name: "جمعية الزاد" } })
        )?.id,
      },
    });
    console.log("seed: created sample beneficiary", sampleId);
  }

  console.log("Seed OK", { admin: admin.mobile, exhibition: exhibition.name });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

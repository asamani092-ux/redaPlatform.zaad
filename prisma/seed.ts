import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role } from "../src/generated/prisma/client";
import { DEFAULT_INVENTORY_SCHEMA } from "../src/lib/inventory-schema";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const mobile = process.env.ADMIN_MOBILE ?? "0500000000";
  const password = process.env.ADMIN_PASSWORD ?? "Admin@1234";
  const passwordHash = await bcrypt.hash(password, 10);
  /** في الإنتاج: لا تُعاد كتابة كلمة المرور إلا بـ SEED_RESET_ADMIN=1 */
  const resetAdmin = process.env.SEED_RESET_ADMIN === "1";
  /** لا تفعيل قسري لمعرض قديم إلا بـ SEED_ACTIVATE_EXHIBITION=1 */
  const forceActivate = process.env.SEED_ACTIVATE_EXHIBITION === "1";
  const migrateSchema = process.env.SEED_MIGRATE_SCHEMA === "1";

  const existingAdmin = await prisma.user.findUnique({ where: { mobile } });
  const admin = await prisma.user.upsert({
    where: { mobile },
    update: {
      name: existingAdmin?.name?.trim() ? existingAdmin.name : "مدير النظام",
      role: Role.ADMIN,
      active: true,
      ...(resetAdmin ? { passwordHash } : {}),
    },
    create: {
      mobile,
      name: "مدير النظام",
      role: Role.ADMIN,
      passwordHash,
    },
  });

  const associations = ["جمعية الزاد", "جمعية البر", "جمعية الإحسان"];
  for (const [i, name] of associations.entries()) {
    await prisma.associationOption.upsert({
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
    await prisma.exhibition.updateMany({ data: { active: false } });
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
  } else if (!exhibition.active && forceActivate) {
    await prisma.exhibition.updateMany({ data: { active: false } });
    exhibition = await prisma.exhibition.update({
      where: { id: exhibition.id },
      data: { active: true },
    });
  }

  // ترقية المخطط القديم إلى options — فقط عند الطلب الصريح حتى لا تُمس إعدادات الإنتاج
  const settings = await prisma.exhibitionSettings.findUnique({
    where: { exhibitionId: exhibition.id },
  });
  if (settings && migrateSchema) {
    const raw = settings.inventorySchemaJson as Array<Record<string, unknown>>;
    if (Array.isArray(raw) && raw.some((r) => !Array.isArray(r.options))) {
      await prisma.exhibitionSettings.update({
        where: { id: settings.id },
        data: { inventorySchemaJson: DEFAULT_INVENTORY_SCHEMA },
      });
    }
  }

  const sampleId = "1100000007";
  await prisma.beneficiary.upsert({
    where: { nationalId: sampleId },
    update: {},
    create: {
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

  console.log("Seed OK", { admin: admin.mobile, exhibition: exhibition.name, sampleId });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

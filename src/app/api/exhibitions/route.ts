import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireSession } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";
import { normalizeExhibitionName } from "@/lib/exhibition";
import { DEFAULT_INVENTORY_SCHEMA } from "@/lib/inventory-schema";

const createSchema = z.object({
  name: z.string().min(2),
  location: z.string().optional().nullable(),
  startsAt: z.string().optional().nullable(),
  endsAt: z.string().optional().nullable(),
  activate: z.boolean().optional(),
  baseEntitlement: z.number().int().positive().optional(),
  entitledPieces: z.number().int().positive().optional(),
  lowStockThreshold: z.number().int().nonnegative().optional(),
});

export async function GET() {
  const authz = await requireSession();
  if ("error" in authz) return authz.error;

  const { hasPermission } = await import("@/lib/rbac");
  if (!hasPermission(authz.role, "exhibitions:manage")) {
    const active = await prisma.exhibition.findFirst({
      where: { active: true },
      select: { id: true, name: true, location: true, active: true },
    });
    return NextResponse.json({ active, data: active ? [active] : [] });
  }

  const data = await prisma.exhibition.findMany({
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
    include: { settings: true },
  });
  const active = data.find((e) => e.active) ?? null;
  return NextResponse.json({ data, active });
}

export async function POST(req: NextRequest) {
  const authz = await requirePermission("exhibitions:manage");
  if ("error" in authz) return authz.error;

  const body = createSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const name = normalizeExhibitionName(body.data.name);
  const dup = await prisma.exhibition.findUnique({ where: { name } });
  if (dup) {
    return NextResponse.json({ error: "يوجد معرض بنفس الاسم" }, { status: 409 });
  }

  const count = await prisma.exhibition.count();
  const shouldActivate = body.data.activate ?? count === 0;

  const created = await prisma.$transaction(async (tx) => {
    if (shouldActivate) {
      await tx.exhibition.updateMany({ data: { active: false } });
    }
    return tx.exhibition.create({
      data: {
        name,
        location: body.data.location?.trim() || null,
        startsAt: body.data.startsAt ? new Date(body.data.startsAt) : null,
        endsAt: body.data.endsAt ? new Date(body.data.endsAt) : null,
        active: shouldActivate,
        settings: {
          create: {
            baseEntitlement: body.data.baseEntitlement ?? body.data.entitledPieces ?? 2,
            lowStockThreshold: body.data.lowStockThreshold ?? 10,
            inventorySchemaJson: DEFAULT_INVENTORY_SCHEMA as unknown as Prisma.InputJsonValue,
            whatsappInviteTpl:
              "مرحباً {{name}}، أنت مدعو إلى {{exhibition}}. الموعد: {{date}} — الموقع: {{location}}",
            whatsappThanksTpl: "شكراً لزيارتك {{exhibition}}، {{name}}.",
            surveyQuestionsJson: [
              { id: "q1", text: "كيف تقيّم تجربة الزيارة؟", type: "scale", min: 1, max: 5 },
              { id: "q2", text: "ملاحظات إضافية", type: "text" },
            ] as unknown as Prisma.InputJsonValue,
          },
        },
      },
      include: { settings: true },
    });
  });

  await writeAuditLog({
    userId: authz.userId,
    action: "EXHIBITION_CREATE",
    entityType: "Exhibition",
    entityId: created.id,
    after: created,
  });

  return NextResponse.json({ data: created }, { status: 201 });
}

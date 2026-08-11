import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";
import { requireActiveExhibition } from "@/lib/exhibition";
import { parseInventorySchema } from "@/lib/inventory-schema";
import { StockMovementType } from "@/generated/prisma/enums";
import { isValidSkuCode, nextSkuCode } from "@/lib/sku-code";
import { summarizeStoreStock } from "@/lib/store-ledger";

const storeSchema = z.object({
  name: z.string().min(1),
  notes: z.string().optional(),
  active: z.boolean().optional(),
});

const contributeSchema = z.object({
  storeId: z.string().min(1),
  inventoryItemId: z.string().optional(),
  attributes: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  quantity: z.number().positive(),
  skuCode: z.string().optional(),
  note: z.string().optional(),
});

function validateAttributes(
  schema: ReturnType<typeof parseInventorySchema>,
  attributes: Record<string, string | number>,
): string | null {
  for (const field of schema) {
    const value = String(attributes[field.key] ?? "").trim();
    if (!value) return `الحقل مطلوب: ${field.label}`;
    if (field.options.length && !field.options.includes(value)) {
      return `قيمة غير مسموحة لحقل ${field.label}`;
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  const authz = await requirePermission("stores:view");
  if ("error" in authz) return authz.error;
  let exhibition;
  try {
    exhibition = await requireActiveExhibition();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "لا يوجد معرض نشط" },
      { status: 400 },
    );
  }

  const day = req.nextUrl.searchParams.get("day")?.trim();
  let dayStart: Date | undefined;
  let dayEnd: Date | undefined;
  if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
    dayStart = new Date(`${day}T00:00:00.000Z`);
    dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  }

  const stores = await prisma.store.findMany({
    where: { exhibitionId: exhibition.id },
    orderBy: { name: "asc" },
  });
  const summary = await summarizeStoreStock(prisma, exhibition.id, { dayStart, dayEnd });
  const schema = parseInventorySchema(exhibition.settings?.inventorySchemaJson);

  return NextResponse.json({
    stores,
    summary,
    schema,
    exhibitionName: exhibition.name,
    day: day || null,
  });
}

export async function POST(req: NextRequest) {
  const authz = await requirePermission("stores:manage");
  if ("error" in authz) return authz.error;
  let exhibition;
  try {
    exhibition = await requireActiveExhibition();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "لا يوجد معرض نشط" },
      { status: 400 },
    );
  }

  const raw = await req.json().catch(() => ({}));
  const action = typeof raw.action === "string" ? raw.action : "create";

  if (action === "contribute") {
    const body = contributeSchema.safeParse(raw);
    if (!body.success) {
      return NextResponse.json({ error: "بيانات المساهمة غير صالحة" }, { status: 400 });
    }
    const store = await prisma.store.findFirst({
      where: { id: body.data.storeId, exhibitionId: exhibition.id, active: true },
    });
    if (!store) {
      return NextResponse.json({ error: "المتجر غير موجود أو غير نشط" }, { status: 404 });
    }

    const schema = parseInventorySchema(exhibition.settings?.inventorySchemaJson);
    const result = await prisma.$transaction(async (tx) => {
      let itemId = body.data.inventoryItemId;
      if (!itemId) {
        if (!body.data.attributes) {
          throw new Error("سمات الصنف مطلوبة عند إنشاء صنف جديد");
        }
        const attrError = validateAttributes(schema, body.data.attributes);
        if (attrError) throw new Error(attrError);

        let skuCode = body.data.skuCode?.trim() ?? "";
        if (skuCode) {
          if (!isValidSkuCode(skuCode)) throw new Error("رمز الصنف يجب أن يكون 4 أو 5 أرقام");
          const clash = await tx.inventoryItem.findFirst({
            where: { exhibitionId: exhibition.id, skuCode },
          });
          if (clash) throw new Error("رمز الصنف مستخدم مسبقاً");
        } else {
          const existing = await tx.inventoryItem.findMany({
            where: { exhibitionId: exhibition.id },
            select: { skuCode: true },
          });
          skuCode = nextSkuCode(existing.map((e) => e.skuCode));
        }

        const created = await tx.inventoryItem.create({
          data: {
            exhibitionId: exhibition.id,
            skuCode,
            attributesJson: body.data.attributes as Prisma.InputJsonValue,
            quantity: new Prisma.Decimal(0),
          },
        });
        itemId = created.id;
      } else {
        const item = await tx.inventoryItem.findFirst({
          where: { id: itemId, exhibitionId: exhibition.id },
        });
        if (!item) throw new Error("الصنف غير موجود في المخزون");
      }

      await tx.inventoryItem.update({
        where: { id: itemId },
        data: { quantity: { increment: body.data.quantity } },
      });
      const movement = await tx.stockMovement.create({
        data: {
          exhibitionId: exhibition.id,
          inventoryItemId: itemId!,
          type: StockMovementType.ADD,
          quantity: new Prisma.Decimal(body.data.quantity),
          storeId: store.id,
          createdById: authz.userId,
          note: body.data.note?.trim() || `مساهمة متجر ${store.name}`,
        },
      });
      return { inventoryItemId: itemId, movementId: movement.id };
    });

    await writeAuditLog({
      userId: authz.userId,
      action: "STORE_CONTRIBUTE",
      entityType: "Store",
      entityId: store.id,
      after: result,
      meta: { quantity: body.data.quantity },
    });

    return NextResponse.json({ data: result }, { status: 201 });
  }

  const body = storeSchema.safeParse(raw);
  if (!body.success) {
    return NextResponse.json({ error: "بيانات المتجر غير صالحة" }, { status: 400 });
  }
  try {
    const created = await prisma.store.create({
      data: {
        exhibitionId: exhibition.id,
        name: body.data.name.trim(),
        notes: body.data.notes?.trim() || null,
        active: body.data.active ?? true,
      },
    });
    await writeAuditLog({
      userId: authz.userId,
      action: "STORE_CREATE",
      entityType: "Store",
      entityId: created.id,
      after: created,
    });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "اسم المتجر مستخدم مسبقاً في هذا المعرض" }, { status: 409 });
  }
}

export async function PATCH(req: NextRequest) {
  const authz = await requirePermission("stores:manage");
  if ("error" in authz) return authz.error;
  let exhibition;
  try {
    exhibition = await requireActiveExhibition();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "لا يوجد معرض نشط" },
      { status: 400 },
    );
  }

  const schema = z.object({
    id: z.string().min(1),
    name: z.string().min(1).optional(),
    notes: z.string().nullable().optional(),
    active: z.boolean().optional(),
  });
  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const existing = await prisma.store.findFirst({
    where: { id: body.data.id, exhibitionId: exhibition.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "المتجر غير موجود" }, { status: 404 });
  }

  try {
    const updated = await prisma.store.update({
      where: { id: existing.id },
      data: {
        name: body.data.name?.trim(),
        notes: body.data.notes === undefined ? undefined : body.data.notes?.trim() || null,
        active: body.data.active,
      },
    });
    await writeAuditLog({
      userId: authz.userId,
      action: "STORE_UPDATE",
      entityType: "Store",
      entityId: updated.id,
      before: existing,
      after: updated,
    });
    return NextResponse.json({ data: updated });
  } catch {
    return NextResponse.json({ error: "تعذّر تحديث المتجر" }, { status: 400 });
  }
}

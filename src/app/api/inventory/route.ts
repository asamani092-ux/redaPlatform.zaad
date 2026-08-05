import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";
import { requireActiveExhibition } from "@/lib/exhibition";
import { parseInventorySchema } from "@/lib/inventory-schema";
import { StockMovementType } from "@/generated/prisma/enums";
import { parsePageParams, paginatedPayload } from "@/lib/pagination";

const createSchema = z.object({
  attributes: z.record(z.string(), z.union([z.string(), z.number()])),
  quantity: z.number().nonnegative(),
});

const updateItemSchema = z.object({
  id: z.string().min(1),
  attributes: z.record(z.string(), z.union([z.string(), z.number()])),
});

const movementSchema = z
  .object({
    inventoryItemId: z.string(),
    type: z.enum(["ADD", "RETURN", "REMOVE"]),
    quantity: z.number().positive(),
    /** سبب الحذف إلزامي عند REMOVE */
    note: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "REMOVE" && !data.note?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "سبب الحذف مطلوب",
        path: ["note"],
      });
    }
  });

const MOVEMENT_TYPE_MAP: Record<"ADD" | "RETURN" | "REMOVE", StockMovementType> = {
  ADD: StockMovementType.ADD,
  RETURN: StockMovementType.RETURN,
  REMOVE: StockMovementType.REMOVE,
};

function validateAttributesAgainstSchema(
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
  const authz = await requirePermission("inventory:manage");
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
  const threshold = exhibition.settings?.lowStockThreshold ?? 10;
  const { page, pageSize, skip, take } = parsePageParams(req.nextUrl.searchParams);
  const where = { exhibitionId: exhibition.id };
  const [total, items] = await Promise.all([
    prisma.inventoryItem.count({ where }),
    prisma.inventoryItem.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take,
    }),
  ]);

  const schema = parseInventorySchema(exhibition.settings?.inventorySchemaJson);
  const withFlags = items.map((item) => ({
    id: item.id,
    attributes: item.attributesJson as Record<string, unknown>,
    attributesJson: item.attributesJson as Record<string, unknown>,
    quantity: Number(item.quantity),
    lowStock: Number(item.quantity) <= threshold,
  }));

  return NextResponse.json({
    ...paginatedPayload(withFlags, page, pageSize, total),
    schema,
    threshold,
    exhibitionName: exhibition.name,
  });
}

export async function POST(req: NextRequest) {
  const authz = await requirePermission("inventory:manage");
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
  const body = createSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const schema = parseInventorySchema(exhibition.settings?.inventorySchemaJson);
  const attrError = validateAttributesAgainstSchema(schema, body.data.attributes);
  if (attrError) {
    return NextResponse.json({ error: attrError }, { status: 400 });
  }

  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.inventoryItem.create({
      data: {
        exhibitionId: exhibition.id,
        attributesJson: body.data.attributes as Prisma.InputJsonValue,
        quantity: new Prisma.Decimal(body.data.quantity),
      },
    });
    if (body.data.quantity > 0) {
      await tx.stockMovement.create({
        data: {
          exhibitionId: exhibition.id,
          inventoryItemId: created.id,
          type: StockMovementType.ADD,
          quantity: new Prisma.Decimal(body.data.quantity),
          createdById: authz.userId,
          note: "إدخال أولي",
        },
      });
    }
    return created;
  });

  await writeAuditLog({
    userId: authz.userId,
    action: "INVENTORY_CREATE",
    entityType: "InventoryItem",
    entityId: item.id,
    after: item,
  });

  return NextResponse.json({ data: item }, { status: 201 });
}

/**
 * تعديل سمات صنف موجود — O(s) للتحقق حيث s عدد حقول المخطط.
 * الكمية تبقى عبر حركات المخزون (PATCH).
 */
export async function PUT(req: NextRequest) {
  const authz = await requirePermission("inventory:manage");
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
  const body = updateItemSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const existing = await prisma.inventoryItem.findFirst({
    where: { id: body.data.id, exhibitionId: exhibition.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "الصنف غير موجود" }, { status: 404 });
  }

  const schema = parseInventorySchema(exhibition.settings?.inventorySchemaJson);
  const attrError = validateAttributesAgainstSchema(schema, body.data.attributes);
  if (attrError) {
    return NextResponse.json({ error: attrError }, { status: 400 });
  }

  // فقط مفاتيح المخطط الحالي (المفاتيح المحذوفة من الإعدادات لا تُحفظ)
  const attributesJson: Record<string, string> = {};
  for (const field of schema) {
    attributesJson[field.key] = String(body.data.attributes[field.key] ?? "").trim();
  }

  const updated = await prisma.inventoryItem.update({
    where: { id: existing.id },
    data: { attributesJson: attributesJson as Prisma.InputJsonValue },
  });

  await writeAuditLog({
    userId: authz.userId,
    action: "INVENTORY_UPDATE",
    entityType: "InventoryItem",
    entityId: updated.id,
    before: existing,
    after: updated,
  });

  return NextResponse.json({ data: updated });
}

export async function PATCH(req: NextRequest) {
  const authz = await requirePermission("inventory:manage");
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
  const body = movementSchema.safeParse(raw);
  if (!body.success) {
    const msg = body.error.issues[0]?.message;
    return NextResponse.json(
      { error: msg === "سبب الحذف مطلوب" ? msg : "بيانات غير صالحة" },
      { status: 400 },
    );
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findFirst({
        where: { id: body.data.inventoryItemId, exhibitionId: exhibition.id },
      });
      if (!item) throw new Error("الصنف غير موجود");

      const qty = body.data.quantity;
      if (body.data.type === "ADD" || body.data.type === "RETURN") {
        await tx.inventoryItem.update({
          where: { id: item.id },
          data: { quantity: { increment: qty } },
        });
      } else if (body.data.type === "REMOVE") {
        const dec = await tx.inventoryItem.updateMany({
          where: {
            id: item.id,
            exhibitionId: exhibition.id,
            quantity: { gte: qty },
          },
          data: { quantity: { decrement: qty } },
        });
        if (dec.count !== 1) {
          throw new Error(`الكمية غير كافية — المتاح ${Number(item.quantity)}`);
        }
      }

      await tx.stockMovement.create({
        data: {
          exhibitionId: exhibition.id,
          inventoryItemId: item.id,
          type: MOVEMENT_TYPE_MAP[body.data.type],
          quantity: new Prisma.Decimal(qty),
          note: body.data.note?.trim() || null,
          createdById: authz.userId,
        },
      });

      return tx.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
    });

    await writeAuditLog({
      userId: authz.userId,
      action: `STOCK_${body.data.type}`,
      entityType: "InventoryItem",
      entityId: updated.id,
      after: updated,
      meta: { quantity: body.data.quantity, note: body.data.note?.trim() || null },
    });

    return NextResponse.json({ data: updated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "فشل تحديث الكمية" },
      { status: 400 },
    );
  }
}

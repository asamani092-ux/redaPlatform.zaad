import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";
import { requireActiveExhibition, type InventorySchemaField } from "@/lib/exhibition";
import { StockMovementType } from "@/generated/prisma/enums";

const createSchema = z.object({
  attributes: z.record(z.string(), z.union([z.string(), z.number()])),
  quantity: z.number().nonnegative(),
});

const movementSchema = z.object({
  inventoryItemId: z.string(),
  type: z.enum(["ADD", "RETURN"]),
  quantity: z.number().positive(),
  note: z.string().optional(),
});

export async function GET() {
  const authz = await requirePermission("inventory:manage");
  if ("error" in authz) return authz.error;
  const exhibition = await requireActiveExhibition();
  const threshold = exhibition.settings?.lowStockThreshold ?? 10;
  const items = await prisma.inventoryItem.findMany({
    where: { exhibitionId: exhibition.id },
    orderBy: { updatedAt: "desc" },
  });

  const schema = (exhibition.settings?.inventorySchemaJson ?? []) as InventorySchemaField[];
  const withFlags = items.map((item) => ({
    id: item.id,
    attributes: item.attributesJson as Record<string, unknown>,
    attributesJson: item.attributesJson as Record<string, unknown>,
    quantity: Number(item.quantity),
    lowStock: Number(item.quantity) <= threshold,
  }));

  return NextResponse.json({ data: withFlags, schema, threshold });
}

export async function POST(req: NextRequest) {
  const authz = await requirePermission("inventory:manage");
  if ("error" in authz) return authz.error;
  const exhibition = await requireActiveExhibition();
  const body = createSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const schema = (exhibition.settings?.inventorySchemaJson ?? []) as InventorySchemaField[];
  for (const field of schema) {
    if (body.data.attributes[field.key] == null || body.data.attributes[field.key] === "") {
      return NextResponse.json({ error: `الحقل مطلوب: ${field.label}` }, { status: 400 });
    }
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

export async function PATCH(req: NextRequest) {
  const authz = await requirePermission("inventory:manage");
  if ("error" in authz) return authz.error;
  const exhibition = await requireActiveExhibition();
  const body = movementSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findFirst({
        where: { id: body.data.inventoryItemId, exhibitionId: exhibition.id },
      });
      if (!item) throw new Error("الصنف غير موجود");

      if (body.data.type === "ADD" || body.data.type === "RETURN") {
        await tx.inventoryItem.update({
          where: { id: item.id },
          data: { quantity: { increment: body.data.quantity } },
        });
      }

      await tx.stockMovement.create({
        data: {
          exhibitionId: exhibition.id,
          inventoryItemId: item.id,
          type:
            body.data.type === "ADD" ? StockMovementType.ADD : StockMovementType.RETURN,
          quantity: new Prisma.Decimal(body.data.quantity),
          note: body.data.note,
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
      meta: { quantity: body.data.quantity, note: body.data.note },
    });

    return NextResponse.json({ data: updated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "فشل تحديث الكمية" },
      { status: 400 },
    );
  }
}

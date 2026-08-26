import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";
import { requireActiveExhibition } from "@/lib/exhibition";
import { StockMovementType } from "@/generated/prisma/enums";
import { hasPermission } from "@/lib/rbac";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { OutboundMessageType } from "@/generated/prisma/enums";

const lineSchema = z.object({
  inventoryItemId: z.string(),
  quantity: z.number().positive(),
});

const dispenseSchema = z.object({
  beneficiaryId: z.string(),
  lines: z.array(lineSchema).min(1),
  entitledOverride: z.number().int().positive().optional(),
  overrideReason: z.string().optional(),
  sendThanks: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const authz = await requirePermission("dispense:manage");
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
  const q = req.nextUrl.searchParams.get("q")?.trim();

  if (q) {
    const beneficiary = await prisma.beneficiary.findFirst({
      where: {
        OR: [{ nationalId: q }, { mobile: q }, { name: { contains: q, mode: "insensitive" } }],
      },
      include: {
        attendances: { where: { exhibitionId: exhibition.id }, take: 1 },
        dispenseOrders: {
          where: { exhibitionId: exhibition.id },
          include: { lines: true },
          take: 1,
        },
        invites: { where: { exhibitionId: exhibition.id }, take: 1 },
      },
    });
    return NextResponse.json({
      beneficiary,
      entitledPieces: exhibition.settings?.entitledPieces ?? 1,
    });
  }

  const [recent, items] = await Promise.all([
    prisma.dispenseOrder.findMany({
      where: { exhibitionId: exhibition.id },
      include: { beneficiary: true, lines: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.inventoryItem.findMany({
      where: { exhibitionId: exhibition.id, quantity: { gt: 0 } },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  return NextResponse.json({
    recent,
    entitledPieces: exhibition.settings?.entitledPieces ?? 1,
    items: items.map((i) => ({
      id: i.id,
      attributes: i.attributesJson,
      attributesJson: i.attributesJson,
      quantity: Number(i.quantity),
    })),
  });
}

export async function POST(req: NextRequest) {
  const authz = await requirePermission("dispense:manage");
  if ("error" in authz) return authz.error;

  const body = dispenseSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  let exhibition;
  try {
    exhibition = await requireActiveExhibition();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "لا يوجد معرض نشط" },
      { status: 400 },
    );
  }
  const settings = exhibition.settings;
  if (!settings) {
    return NextResponse.json({ error: "إعدادات المعرض غير موجودة" }, { status: 400 });
  }

  const attendance = await prisma.attendance.findUnique({
    where: {
      exhibitionId_beneficiaryId: {
        exhibitionId: exhibition.id,
        beneficiaryId: body.data.beneficiaryId,
      },
    },
  });
  if (!attendance) {
    return NextResponse.json(
      { error: "الصرف يشترط تسجيل الحضور أولاً (أو حضور باستثناء)" },
      { status: 400 },
    );
  }

  const existing = await prisma.dispenseOrder.findUnique({
    where: {
      exhibitionId_beneficiaryId: {
        exhibitionId: exhibition.id,
        beneficiaryId: body.data.beneficiaryId,
      },
    },
  });
  if (existing) {
    return NextResponse.json({ error: "تم الصرف مسبقاً لهذا المستفيد" }, { status: 409 });
  }

  let entitled = settings.entitledPieces;
  if (body.data.entitledOverride != null && body.data.entitledOverride !== entitled) {
    if (!hasPermission(authz.role, "dispense:override")) {
      return NextResponse.json({ error: "تعديل الاستحقاق يتطلب صلاحية مشرف" }, { status: 403 });
    }
    if (!body.data.overrideReason?.trim()) {
      return NextResponse.json({ error: "سبب تعديل الاستحقاق مطلوب" }, { status: 400 });
    }
    entitled = body.data.entitledOverride;
  }

  const totalQty = body.data.lines.reduce((s, l) => s + l.quantity, 0);
  if (totalQty > entitled) {
    return NextResponse.json(
      { error: `تجاوز الاستحقاق (${entitled}) — المطلوب ${totalQty}` },
      { status: 400 },
    );
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      for (const line of body.data.lines) {
        const updated = await tx.inventoryItem.updateMany({
          where: {
            id: line.inventoryItemId,
            exhibitionId: exhibition.id,
            quantity: { gte: line.quantity },
          },
          data: {
            quantity: { decrement: line.quantity },
          },
        });
        if (updated.count !== 1) {
          throw new Error(`كمية غير كافية للصنف ${line.inventoryItemId}`);
        }
        await tx.stockMovement.create({
          data: {
            exhibitionId: exhibition.id,
            inventoryItemId: line.inventoryItemId,
            type: StockMovementType.DISPENSE,
            quantity: new Prisma.Decimal(line.quantity),
            createdById: authz.userId,
            note: `صرف للمستفيد ${body.data.beneficiaryId}`,
          },
        });
      }

      return tx.dispenseOrder.create({
        data: {
          exhibitionId: exhibition.id,
          beneficiaryId: body.data.beneficiaryId,
          piecesCount: totalQty,
          entitledOverride: body.data.entitledOverride ?? null,
          overrideReason: body.data.overrideReason?.trim() || null,
          createdById: authz.userId,
          lines: {
            create: body.data.lines.map((l) => ({
              inventoryItemId: l.inventoryItemId,
              quantity: new Prisma.Decimal(l.quantity),
            })),
          },
        },
        include: { lines: true, beneficiary: true },
      });
    });

    await writeAuditLog({
      userId: authz.userId,
      action: "DISPENSE",
      entityType: "DispenseOrder",
      entityId: order.id,
      after: order,
    });

    if (body.data.sendThanks) {
      const tpl =
        settings.whatsappThanksTpl ??
        "شكراً لزيارتك {{exhibition}}، {{name}}.";
      const bodyText = tpl
        .replaceAll("{{name}}", order.beneficiary.name)
        .replaceAll("{{exhibition}}", exhibition.name);
      await sendWhatsAppMessage({
        exhibitionId: exhibition.id,
        beneficiaryId: order.beneficiaryId,
        mobile: order.beneficiary.mobile,
        body: bodyText,
        type: OutboundMessageType.THANK_YOU,
        createdById: authz.userId,
        templateParams: [order.beneficiary.name, exhibition.name],
      });
    }

    return NextResponse.json({ data: order }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "فشل الصرف" },
      { status: 409 },
    );
  }
}

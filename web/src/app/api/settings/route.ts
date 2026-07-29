import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";
import { getActiveExhibition } from "@/lib/exhibition";
import { Prisma } from "@/generated/prisma/client";

const schemaField = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "number"]),
});

const settingsSchema = z.object({
  exhibitionName: z.string().optional(),
  location: z.string().optional().nullable(),
  entitledPieces: z.number().int().positive().optional(),
  lowStockThreshold: z.number().int().nonnegative().optional(),
  inventorySchema: z.array(schemaField).optional(),
  whatsappInviteTpl: z.string().optional().nullable(),
  whatsappThanksTpl: z.string().optional().nullable(),
  surveyQuestions: z.array(z.record(z.string(), z.unknown())).optional(),
  associations: z
    .array(z.object({ id: z.string().optional(), name: z.string().min(1), active: z.boolean().optional() }))
    .optional(),
});

export async function GET() {
  const authz = await requirePermission("settings:manage");
  if ("error" in authz) return authz.error;

  const exhibition = await getActiveExhibition();
  const associations = await prisma.associationOption.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ exhibition, associations });
}

export async function PUT(req: NextRequest) {
  const authz = await requirePermission("settings:manage");
  if ("error" in authz) return authz.error;

  const body = settingsSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  let exhibition = await getActiveExhibition();
  if (!exhibition) {
    exhibition = await prisma.exhibition.create({
      data: {
        name: body.data.exhibitionName || "معرض رداء",
        location: body.data.location || null,
        active: true,
        settings: {
          create: {
            entitledPieces: body.data.entitledPieces ?? 2,
            lowStockThreshold: body.data.lowStockThreshold ?? 10,
            inventorySchemaJson: (body.data.inventorySchema ?? [
              { key: "type", label: "النوع", type: "text" },
              { key: "category", label: "الصنف", type: "text" },
              { key: "color", label: "اللون", type: "text" },
              { key: "unit", label: "الوحدة", type: "text" },
            ]) as Prisma.InputJsonValue,
          },
        },
      },
      include: { settings: true },
    });
  } else {
    await prisma.exhibition.update({
      where: { id: exhibition.id },
      data: {
        name: body.data.exhibitionName ?? exhibition.name,
        location: body.data.location === undefined ? undefined : body.data.location,
      },
    });

    const inventoryCount = await prisma.inventoryItem.count({
      where: { exhibitionId: exhibition.id },
    });

    if (body.data.inventorySchema && inventoryCount > 0) {
      // لا نغيّر مخطط السمات بعد إدخال أصناف — حسب القرار
      const current = exhibition.settings?.inventorySchemaJson;
      if (JSON.stringify(current) !== JSON.stringify(body.data.inventorySchema)) {
        return NextResponse.json(
          { error: "لا يمكن تغيير نوع/صنف مخطط المخزون بعد إدخال أصناف — الكمية فقط" },
          { status: 400 },
        );
      }
    }

    await prisma.exhibitionSettings.upsert({
      where: { exhibitionId: exhibition.id },
      update: {
        entitledPieces: body.data.entitledPieces,
        lowStockThreshold: body.data.lowStockThreshold,
        inventorySchemaJson: body.data.inventorySchema
          ? (body.data.inventorySchema as Prisma.InputJsonValue)
          : undefined,
        whatsappInviteTpl: body.data.whatsappInviteTpl,
        whatsappThanksTpl: body.data.whatsappThanksTpl,
        surveyQuestionsJson: body.data.surveyQuestions
          ? (body.data.surveyQuestions as Prisma.InputJsonValue)
          : undefined,
      },
      create: {
        exhibitionId: exhibition.id,
        entitledPieces: body.data.entitledPieces ?? 2,
        lowStockThreshold: body.data.lowStockThreshold ?? 10,
        inventorySchemaJson: (body.data.inventorySchema ?? []) as Prisma.InputJsonValue,
        whatsappInviteTpl: body.data.whatsappInviteTpl,
        whatsappThanksTpl: body.data.whatsappThanksTpl,
        surveyQuestionsJson: (body.data.surveyQuestions ?? []) as Prisma.InputJsonValue,
      },
    });
  }

  if (body.data.associations) {
    for (const [i, a] of body.data.associations.entries()) {
      if (a.id) {
        await prisma.associationOption.update({
          where: { id: a.id },
          data: { name: a.name, active: a.active ?? true, sortOrder: i },
        });
      } else {
        await prisma.associationOption.upsert({
          where: { name: a.name },
          update: { active: a.active ?? true, sortOrder: i },
          create: { name: a.name, sortOrder: i, active: a.active ?? true },
        });
      }
    }
  }

  await writeAuditLog({
    userId: authz.userId,
    action: "UPDATE_SETTINGS",
    entityType: "ExhibitionSettings",
    entityId: exhibition.id,
    after: body.data,
  });

  const fresh = await getActiveExhibition();
  const associations = await prisma.associationOption.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ exhibition: fresh, associations });
}

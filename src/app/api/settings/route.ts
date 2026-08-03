import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";
import {
  getActiveExhibition,
  normalizeExhibitionName,
} from "@/lib/exhibition";
import {
  DEFAULT_INVENTORY_SCHEMA,
  parseInventorySchema,
  validateInventorySchemaMutation,
} from "@/lib/inventory-schema";
import { parseSurveyConfig } from "@/lib/survey-questions";
import { Prisma } from "@/generated/prisma/client";

const schemaField = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  options: z.array(z.string()).default([]),
});

const settingsSchema = z.object({
  exhibitionName: z.string().optional(),
  location: z.string().optional().nullable(),
  baseEntitlement: z.number().int().positive().optional(),
  /** توافق خلفي مع الحقل السابق */
  entitledPieces: z.number().int().positive().optional(),
  lowStockThreshold: z.number().int().nonnegative().optional(),
  inventorySchema: z.array(schemaField).optional(),
  whatsappInviteTpl: z.string().optional().nullable(),
  whatsappThanksTpl: z.string().optional().nullable(),
  surveyQuestions: z.array(z.record(z.string(), z.unknown())).optional(),
  surveyExternalUrl: z.string().optional().nullable(),
  associations: z
    .array(z.object({ id: z.string().optional(), name: z.string().min(1), active: z.boolean().optional() }))
    .optional(),
});

export async function GET() {
  const authz = await requirePermission("settings:manage");
  if ("error" in authz) return authz.error;

  const exhibition = await getActiveExhibition();
  const associations = await prisma.associationOption.findMany({ orderBy: { sortOrder: "asc" } });
  const inventoryCount = exhibition
    ? await prisma.inventoryItem.count({ where: { exhibitionId: exhibition.id } })
    : 0;
  return NextResponse.json({
    exhibition: exhibition
      ? {
          ...exhibition,
          settings: exhibition.settings
            ? {
                ...exhibition.settings,
                inventorySchemaJson: parseInventorySchema(
                  exhibition.settings.inventorySchemaJson,
                ),
              }
            : null,
        }
      : null,
    associations,
    inventoryCount,
  });
}

export async function PUT(req: NextRequest) {
  const authz = await requirePermission("settings:manage");
  if ("error" in authz) return authz.error;

  const body = settingsSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const exhibition = await getActiveExhibition();
  if (!exhibition) {
    return NextResponse.json(
      { error: "لا يوجد معرض نشط — أنشئ أو فعّل معرضاً من إدارة المعارض" },
      { status: 400 },
    );
  }

  if (body.data.exhibitionName) {
    const name = normalizeExhibitionName(body.data.exhibitionName);
    const dup = await prisma.exhibition.findFirst({
      where: { name, NOT: { id: exhibition.id } },
    });
    if (dup) {
      return NextResponse.json({ error: "يوجد معرض بنفس الاسم" }, { status: 409 });
    }
    await prisma.exhibition.update({
      where: { id: exhibition.id },
      data: {
        name,
        location: body.data.location === undefined ? undefined : body.data.location,
      },
    });
  } else if (body.data.location !== undefined) {
    await prisma.exhibition.update({
      where: { id: exhibition.id },
      data: { location: body.data.location },
    });
  }

  const inventoryCount = await prisma.inventoryItem.count({
    where: { exhibitionId: exhibition.id },
  });

  let schemaPayload:
    | Array<{ key: string; label: string; options: string[] }>
    | undefined;
  if (body.data.inventorySchema) {
    const current = parseInventorySchema(exhibition.settings?.inventorySchemaJson);
    const schemaError = validateInventorySchemaMutation(
      current,
      body.data.inventorySchema,
      inventoryCount > 0,
    );
    if (schemaError) {
      return NextResponse.json({ error: schemaError }, { status: 400 });
    }
    schemaPayload = body.data.inventorySchema.map((f) => ({
      key: f.key.trim(),
      label: f.label.trim(),
      options: [...new Set(f.options.map((o) => o.trim()).filter(Boolean))],
    }));
  }

  // إعداد الاستبيان يُخزن كغلاف { questions, externalUrl } مع الحفاظ على القائم عند غياب أحدهما
  let surveyPayload: Prisma.InputJsonValue | undefined;
  if (body.data.surveyQuestions !== undefined || body.data.surveyExternalUrl !== undefined) {
    const current = parseSurveyConfig(exhibition.settings?.surveyQuestionsJson);
    surveyPayload = {
      questions: (body.data.surveyQuestions ?? current.questions) as unknown[],
      externalUrl:
        body.data.surveyExternalUrl !== undefined
          ? body.data.surveyExternalUrl?.trim() || null
          : current.externalUrl,
    } as unknown as Prisma.InputJsonValue;
  }

  await prisma.exhibitionSettings.upsert({
    where: { exhibitionId: exhibition.id },
    update: {
      baseEntitlement: body.data.baseEntitlement ?? body.data.entitledPieces,
      lowStockThreshold: body.data.lowStockThreshold,
      inventorySchemaJson: schemaPayload
        ? (schemaPayload as unknown as Prisma.InputJsonValue)
        : undefined,
      whatsappInviteTpl: body.data.whatsappInviteTpl,
      whatsappThanksTpl: body.data.whatsappThanksTpl,
      surveyQuestionsJson: surveyPayload,
    },
    create: {
      exhibitionId: exhibition.id,
      baseEntitlement: body.data.baseEntitlement ?? body.data.entitledPieces ?? 2,
      lowStockThreshold: body.data.lowStockThreshold ?? 10,
      inventorySchemaJson: (schemaPayload ?? DEFAULT_INVENTORY_SCHEMA) as unknown as Prisma.InputJsonValue,
      whatsappInviteTpl: body.data.whatsappInviteTpl,
      whatsappThanksTpl: body.data.whatsappThanksTpl,
      surveyQuestionsJson: (surveyPayload ?? { questions: [], externalUrl: null }) as Prisma.InputJsonValue,
    },
  });

  if (body.data.associations) {
    for (const [i, a] of body.data.associations.entries()) {
      if (a.id) {
        await prisma.associationOption.update({
          where: { id: a.id },
          data: { name: a.name, active: a.active ?? true, sortOrder: i },
        });
      } else if (a.name.trim()) {
        await prisma.associationOption.upsert({
          where: { name: a.name.trim() },
          update: { active: a.active ?? true, sortOrder: i },
          create: { name: a.name.trim(), sortOrder: i, active: a.active ?? true },
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
  return NextResponse.json({
    exhibition: fresh
      ? {
          ...fresh,
          settings: fresh.settings
            ? {
                ...fresh.settings,
                inventorySchemaJson: parseInventorySchema(fresh.settings.inventorySchemaJson),
              }
            : null,
        }
      : null,
    associations,
  });
}

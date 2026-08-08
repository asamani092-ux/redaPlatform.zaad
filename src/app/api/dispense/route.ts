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
import { effectiveEntitlement, entitlementWithExtra, isNonEmptyReason } from "@/lib/entitlement";
import { parseInventorySchema } from "@/lib/inventory-schema";
import { buildPageMeta, parsePageParams } from "@/lib/pagination";
import {
  autoSendSurveysOnDispense,
  parseSurveyCatalog,
  parseSurveyConfig,
} from "@/lib/survey-questions";
import { buildSurveyMessage } from "@/lib/survey-message";
import { priorDispenseStats } from "@/lib/report-counts";

const lineSchema = z.object({
  inventoryItemId: z.string(),
  quantity: z.number().int().positive(),
});

const dispenseSchema = z.object({
  beneficiaryId: z.string(),
  lines: z.array(lineSchema).min(1, "حدد كمية لصنف واحد على الأقل"),
  /** قطع إضافية فوق الاستحقاق المحسوب (ليست بديلاً عنه) */
  extraAbove: z.number().int().nonnegative().optional(),
  /** توافق خلفي: إجمالي الاستحقاق النهائي */
  entitledOverride: z.number().int().positive().optional(),
  overrideReason: z.string().optional(),
  /** إلزامي عند صرف لاحق لمستفيد صُرف له سابقاً */
  repeatReason: z.string().optional(),
  sendThanks: z.boolean().optional(),
  /** إرسال رابط الاستبيان واتساباً بعد نجاح الصرف */
  sendSurvey: z.boolean().optional(),
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
  const base = exhibition.settings?.baseEntitlement ?? 1;
  const perDep = exhibition.settings?.dependentsEntitlement ?? 1;

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
    const deps = beneficiary?.dependentsCount ?? 0;
    const effective = effectiveEntitlement(base, deps, perDep);
    return NextResponse.json({
      beneficiary,
      baseEntitlement: base,
      dependentsEntitlement: perDep,
      dependentsCount: deps,
      effectiveEntitlement: effective,
      entitledPieces: effective,
    });
  }

  const { page, pageSize, skip, take } = parsePageParams(req.nextUrl.searchParams);
  const where = { exhibitionId: exhibition.id };
  const [count, recent, items] = await Promise.all([
    prisma.dispenseOrder.count({ where }),
    prisma.dispenseOrder.findMany({
      where,
      include: { beneficiary: true, lines: true },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    // أصناف الصرف تبقى كاملة لاختيار الكمية أثناء العملية (عادة قليلة)
    prisma.inventoryItem.findMany({
      where: { exhibitionId: exhibition.id, quantity: { gt: 0 } },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  const surveyCatalog = parseSurveyCatalog(exhibition.settings?.surveyQuestionsJson);
  return NextResponse.json({
    recent,
    baseEntitlement: base,
    dependentsEntitlement: perDep,
    entitledPieces: base,
    inventorySchema: parseInventorySchema(exhibition.settings?.inventorySchemaJson),
    surveyAutoSendOnDispense: autoSendSurveysOnDispense(surveyCatalog).length > 0,
    items: items.map((i) => ({
      id: i.id,
      attributes: i.attributesJson,
      attributesJson: i.attributesJson,
      quantity: Number(i.quantity),
    })),
    ...buildPageMeta(page, pageSize, count),
  });
}

export async function POST(req: NextRequest) {
  const authz = await requirePermission("dispense:manage");
  if ("error" in authz) return authz.error;

  const body = dispenseSchema.safeParse(await req.json());
  if (!body.success) {
    const issue = body.error.issues[0];
    return NextResponse.json(
      {
        error:
          issue?.message === "حدد كمية لصنف واحد على الأقل"
            ? issue.message
            : "بيانات غير صالحة — الكميات أعداد صحيحة موجبة",
      },
      { status: 400 },
    );
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

  const beneficiary = await prisma.beneficiary.findUnique({
    where: { id: body.data.beneficiaryId },
  });
  if (!beneficiary) {
    return NextResponse.json({ error: "المستفيد غير موجود" }, { status: 404 });
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

  const prior = await priorDispenseStats(exhibition.id, body.data.beneficiaryId);
  const isRepeat = prior.count > 0;
  const previousPiecesTotal = prior.previousPiecesTotal;

  if (isRepeat) {
    if (!hasPermission(authz.role, "dispense:override")) {
      return NextResponse.json(
        { error: "الصرف المتكرر يتطلب صلاحية الاستثناء (توزيع أو مدير)" },
        { status: 403 },
      );
    }
    if (!isNonEmptyReason(body.data.repeatReason)) {
      return NextResponse.json(
        { error: "سبب الصرف الاستثنائي مطلوب لأن المستفيد صُرف له سابقاً" },
        { status: 400 },
      );
    }
  }

  const base = settings.baseEntitlement;
  const perDep = settings.dependentsEntitlement ?? 1;
  const deps = beneficiary.dependentsCount;
  const computed = effectiveEntitlement(base, deps, perDep);
  let entitled = computed;
  let entitledOverride: number | null = null;
  let overrideReason: string | null = null;

  const extraAbove = body.data.extraAbove ?? null;
  const wantsExtra = extraAbove != null && extraAbove > 0;
  const wantsLegacyOverride =
    !wantsExtra &&
    body.data.entitledOverride != null &&
    body.data.entitledOverride !== computed;

  if (wantsExtra || wantsLegacyOverride) {
    if (!hasPermission(authz.role, "dispense:override")) {
      return NextResponse.json(
        { error: "الإضافة فوق الاستحقاق تتطلب صلاحية اعتماد الاستثناء (توزيع أو مدير)" },
        { status: 403 },
      );
    }
    if (!isNonEmptyReason(body.data.overrideReason)) {
      return NextResponse.json({ error: "سبب الإضافة فوق الاستحقاق مطلوب" }, { status: 400 });
    }
    entitledOverride = wantsExtra
      ? entitlementWithExtra(computed, extraAbove)
      : body.data.entitledOverride!;
    overrideReason = body.data.overrideReason!.trim();
    entitled = entitledOverride;
  }

  // صرف متكرر: السبب يُسجَّل مع الاستثناء (تراكمي — لا يستبدل الصرف السابق)
  if (isRepeat) {
    const repeat = body.data.repeatReason!.trim();
    overrideReason = overrideReason ? `${overrideReason} | إعادة صرف: ${repeat}` : `إعادة صرف: ${repeat}`;
    if (entitledOverride == null) {
      entitledOverride = entitled;
    }
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
          entitledOverride,
          overrideReason,
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

    if (entitledOverride != null) {
      await writeAuditLog({
        userId: authz.userId,
        action: "ENTITLEMENT_OVERRIDE",
        entityType: "DispenseOrder",
        entityId: order.id,
        before: {
          effectiveEntitlement: computed,
          baseEntitlement: base,
          dependentsEntitlement: perDep,
          dependentsCount: deps,
        },
        after: {
          effectiveEntitlement: entitledOverride,
          entitledOverride,
        },
        meta: { reason: overrideReason, beneficiaryId: beneficiary.id },
      });
    }

    await writeAuditLog({
      userId: authz.userId,
      action: "DISPENSE",
      entityType: "DispenseOrder",
      entityId: order.id,
      after: order,
      meta: {
        effectiveEntitlement: entitled,
        baseEntitlement: base,
        dependentsEntitlement: perDep,
        dependentsCount: deps,
        overrideReason,
        isRepeat,
        previousPiecesTotal: isRepeat ? previousPiecesTotal : undefined,
        priorOrderCount: isRepeat ? prior.count : undefined,
      },
    });

    let thanksStatus: string | null = null;
    let thanksError: string | null = null;
    let surveyStatus: string | null = null;
    let surveyError: string | null = null;

    if (body.data.sendThanks) {
      const tpl =
        settings.whatsappThanksTpl ??
        "شكراً لزيارتك معرض رداء، {{name}}.";
      const thanksBody = tpl
        .replaceAll("{{name}}", order.beneficiary.name)
        .replaceAll("{{exhibition}}", exhibition.name);
      const thanksMsg = await sendWhatsAppMessage({
        exhibitionId: exhibition.id,
        beneficiaryId: order.beneficiaryId,
        mobile: order.beneficiary.mobile,
        body: thanksBody,
        type: OutboundMessageType.THANK_YOU,
        createdById: authz.userId,
      });
      thanksStatus = thanksMsg.status;
      if (thanksMsg.status === "FAILED") {
        thanksError = thanksMsg.errorMessage || "فشل إرسال رسالة الشكر";
      }
    }

    const surveyCatalog = parseSurveyCatalog(settings.surveyQuestionsJson);
    const autoSurveys = autoSendSurveysOnDispense(surveyCatalog);
    const wantSurvey =
      body.data.sendSurvey !== undefined
        ? body.data.sendSurvey
        : autoSurveys.length > 0;
    if (wantSurvey) {
      const toSend =
        autoSurveys.length > 0
          ? autoSurveys
          : (() => {
              const fallback = parseSurveyConfig(settings.surveyQuestionsJson);
              return fallback.questions.length || fallback.externalUrl
                ? [
                    {
                      id: "default",
                      title: "استبيان الرضا",
                      audience: "received" as const,
                      questions: fallback.questions,
                      externalUrl: fallback.externalUrl,
                      autoSendOnDispense: true,
                      active: true,
                    },
                  ]
                : [];
            })();
      if (!order.beneficiary.mobile) {
        surveyStatus = "FAILED";
        surveyError = "لا يوجد رقم جوال للمستفيد";
      } else if (!toSend.length) {
        surveyStatus = "FAILED";
        surveyError = "لا استبيان مفعّل للإرسال بعد الصرف";
      } else {
        const errors: string[] = [];
        let lastStatus: string | null = null;
        for (const survey of toSend) {
          const surveyMsg = await sendWhatsAppMessage({
            exhibitionId: exhibition.id,
            beneficiaryId: order.beneficiaryId,
            mobile: order.beneficiary.mobile,
            body: buildSurveyMessage(
              order.beneficiary.name,
              exhibition.name,
              survey.externalUrl,
              survey.title,
            ),
            type: OutboundMessageType.SURVEY,
            createdById: authz.userId,
          });
          lastStatus = surveyMsg.status;
          if (surveyMsg.status === "FAILED") {
            errors.push(
              `${survey.title}: ${surveyMsg.errorMessage || "فشل الإرسال"}`,
            );
          }
        }
        surveyStatus = errors.length
          ? "FAILED"
          : lastStatus === "STUBBED"
            ? "STUBBED"
            : "SENT";
        if (errors.length) surveyError = errors.join(" — ");
      }
    }

    return NextResponse.json(
      {
        data: order,
        thanksStatus,
        thanksError,
        surveyStatus,
        surveyError,
      },
      { status: 201 },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "فشل الصرف" },
      { status: 409 },
    );
  }
}

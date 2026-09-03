import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { getActiveExhibition } from "@/lib/exhibition";
import { STATUS_LABELS, resolveStatus } from "@/lib/status";
import { hasPermission } from "@/lib/rbac";
import { canExportFullIdentity, redactIdentityFields } from "@/lib/pii";
import { Role } from "@/generated/prisma/enums";
import { buildPrintDocument, escapeHtml } from "@/lib/print-html";
import {
  buildBreakdownShares,
  householdSize,
  sharesToRecord,
} from "@/lib/report-metrics";
import { fetchTopDispensedItems } from "@/lib/top-dispensed";
import {
  applyPresentationSelection,
  buildZadPresentationReport,
} from "@/lib/zad-presentation-report";
import { countDistinctReceived } from "@/lib/report-counts";
import {
  attributeLabelsFromSchema,
  parseInventorySchema,
} from "@/lib/inventory-schema";
import { summarizePlatformStock, summarizeStoreStock } from "@/lib/store-ledger";
import {
  exhibitionDays,
  findExhibitionDay,
  isDateKey,
  riyadhDayBounds,
  type ExhibitionDay,
} from "@/lib/exhibition-days";
import { buildDailyReportMetrics } from "@/lib/daily-report-metrics";
import { countAttendanceFamiliesAndIndividuals } from "@/lib/scoped-report-summary";
import { sumDispensedByKind } from "@/lib/exhibition-kpis";

export async function GET(req: NextRequest) {
  const authz = await requirePermission("reports:view");
  if ("error" in authz) return authz.error;

  const format = req.nextUrl.searchParams.get("format") ?? "json";
  const requestedId = req.nextUrl.searchParams.get("exhibitionId");
  const active = await getActiveExhibition();
  const exportFullIdentity = canExportFullIdentity(authz.role as Role);

  if (
    (format === "xlsx" || format === "pdf") &&
    !exportFullIdentity &&
    req.nextUrl.searchParams.get("fullIdentity") === "1"
  ) {
    return NextResponse.json(
      { error: "تصدير الهوية والجوال الكامل مقصور على المدير" },
      { status: 403 },
    );
  }

  let exhibition = active;
  if (requestedId) {
    if (!hasPermission(authz.role, "exhibitions:manage") && authz.role !== "ADMIN") {
      return NextResponse.json(
        { error: "اختيار معرض للتقارير متاح للمدير فقط" },
        { status: 403 },
      );
    }
    exhibition = await prisma.exhibition.findUnique({
      where: { id: requestedId },
      include: { settings: true },
    });
    if (!exhibition) {
      return NextResponse.json({ error: "المعرض غير موجود" }, { status: 404 });
    }
  }

  if (!exhibition) {
    return NextResponse.json(
      { error: "لا يوجد معرض نشط — أنشئ أو فعّل معرضاً من إدارة المعارض" },
      { status: 400 },
    );
  }

  const exhibitionId = exhibition.id;

  /** أيام المعرض بتوقيت الرياض — أساس التقارير اليومية */
  const days = exhibitionDays({
    startsAt: exhibition.startsAt,
    endsAt: exhibition.endsAt,
  });
  const dayParam = req.nextUrl.searchParams.get("day");
  const dayIndexParam = req.nextUrl.searchParams.get("dayIndex");
  let selectedDayRef: ExhibitionDay | null = null;
  if (dayParam || dayIndexParam) {
    if (dayParam && !isDateKey(dayParam)) {
      return NextResponse.json(
        { error: "صيغة اليوم غير صالحة — استخدم YYYY-MM-DD" },
        { status: 400 },
      );
    }
    const dayIndex = dayIndexParam ? Number(dayIndexParam) : null;
    if (dayIndexParam && !Number.isInteger(dayIndex)) {
      return NextResponse.json(
        { error: "ترتيب اليوم غير صالح" },
        { status: 400 },
      );
    }
    selectedDayRef = findExhibitionDay(days, {
      dateKey: dayParam,
      dayIndex,
    });
    if (!selectedDayRef) {
      return NextResponse.json(
        { error: "اليوم المطلوب خارج فترة المعرض" },
        { status: 400 },
      );
    }
  }

  /** مسار العرض التقديمي: أعمدة ديموغرافية + تجميعات فقط — بدون شجرة الصرف الكاملة */
  if (format === "presentation") {
    const [
      demoBeneficiaries,
      invited,
      attended,
      received,
      exceptionAttendance,
      overrideDispenses,
      piecesAgg,
      topItems,
      totalBeneficiaries,
      storeSummary,
      platformStock,
      volunteers,
    ] = await Promise.all([
      prisma.beneficiary.findMany({
        select: {
          gender: true,
          city: true,
          neighborhood: true,
          dependentsCount: true,
          associationOther: true,
          association: { select: { name: true } },
        },
      }),
      prisma.exhibitionInvite.count({ where: { exhibitionId, invited: true } }),
      prisma.attendance.count({ where: { exhibitionId } }),
      countDistinctReceived(exhibitionId),
      prisma.attendance.count({
        where: { exhibitionId, type: "EXCEPTION" },
      }),
      prisma.dispenseOrder.count({
        where: { exhibitionId, entitledOverride: { not: null } },
      }),
      prisma.dispenseOrder.aggregate({
        where: { exhibitionId },
        _sum: { piecesCount: true },
      }),
      fetchTopDispensedItems(exhibitionId, 5),
      prisma.beneficiary.count(),
      summarizeStoreStock(prisma, exhibitionId),
      summarizePlatformStock(prisma, exhibitionId),
      prisma.volunteer.count({ where: { exhibitionId } }),
    ]);

    const breakdowns = buildBreakdownShares({
      associations: demoBeneficiaries.map(
        (b) => b.association?.name ?? b.associationOther ?? "",
      ),
      neighborhoods: demoBeneficiaries.map((b) => b.neighborhood ?? ""),
      cities: demoBeneficiaries.map((b) => b.city ?? ""),
      genders: demoBeneficiaries.map((b) =>
        b.gender === "MALE" ? "ذكر" : b.gender === "FEMALE" ? "أنثى" : "",
      ),
      dependentsCounts: demoBeneficiaries.map((b) => b.dependentsCount),
    });

    const summary = {
      exhibitionId: exhibition.id,
      exhibitionName: exhibition.name,
      exhibitionActive: exhibition.active,
      totalBeneficiaries,
      invited,
      attended,
      received,
      volunteers,
      exceptionAttendance,
      overrideDispenses,
      piecesDispensed: piecesAgg._sum.piecesCount ?? 0,
      storeSummary,
      storeContributed: storeSummary.reduce((s, r) => s + r.added, 0),
      storeDispensed: storeSummary.reduce((s, r) => s + r.dispensed, 0),
      storeRemaining: storeSummary.reduce((s, r) => s + r.remaining, 0),
      platformContributed: platformStock.added,
      platformDispensed: platformStock.dispensed,
      platformRemaining: platformStock.remaining,
      beneficiaryFamilies: breakdowns.households.beneficiaryFamilies,
      totalIndividuals: breakdowns.households.totalIndividuals,
      byGender: sharesToRecord(breakdowns.byGender),
      byCity: sharesToRecord(breakdowns.byCity),
      byNeighborhood: sharesToRecord(breakdowns.byNeighborhood),
      byFamilySize: sharesToRecord(breakdowns.households.byHouseholdSize),
      byAssociation: sharesToRecord(breakdowns.byAssociation),
      byGenderShares: breakdowns.byGender,
      byCityShares: breakdowns.byCity,
      byNeighborhoodShares: breakdowns.byNeighborhood,
      byAssociationShares: breakdowns.byAssociation,
      byHouseholdSizeShares: breakdowns.households.byHouseholdSize,
      topItems,
      attributeLabels: attributeLabelsFromSchema(
        parseInventorySchema(exhibition.settings?.inventorySchemaJson),
      ),
    };

    const slidesParam = req.nextUrl.searchParams.get("slides");
    const kpisParam = req.nextUrl.searchParams.get("kpis");
    const report = applyPresentationSelection(buildZadPresentationReport(summary), {
      slides: slidesParam
        ? slidesParam.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined,
      kpis: kpisParam
        ? kpisParam.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined,
    });
    const asHtml = req.nextUrl.searchParams.get("html") === "1";
    if (!asHtml) {
      return NextResponse.json({ report });
    }
    const templatePath = path.join(
      process.cwd(),
      "public/zad-presentation/builder.html",
    );
    let html = await readFile(templatePath, "utf8");
    const payload = JSON.stringify(report).replace(/</g, "\\u003c");
    if (!html.includes("<!--ZAD_REPORT_INJECT-->")) {
      return NextResponse.json(
        { error: "قالب منشئ العرض غير جاهز" },
        { status: 500 },
      );
    }
    html = html.replace(
      "<!--ZAD_REPORT_INJECT-->",
      `<script>window.ZAD_REPORT=${payload};</script>`,
    );
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  const beneficiaries = await prisma.beneficiary.findMany({
    include: {
      association: true,
      invites: { where: { exhibitionId }, take: 1 },
      attendances: { where: { exhibitionId }, take: 1 },
      dispenseOrders: {
        where: { exhibitionId },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const rows = beneficiaries.map((b) => {
    const invite = b.invites[0];
    const attendance = b.attendances[0];
    const orders = b.dispenseOrders;
    const latest = orders[0] ?? null;
    const piecesTotal = orders.reduce((s, o) => s + o.piecesCount, 0);
    const status = resolveStatus({
      invited: invite?.invited,
      attendanceType: attendance?.type ?? null,
      received: orders.length > 0,
    });
    return {
      name: b.name,
      nationalId: b.nationalId,
      mobile: b.mobile,
      gender: b.gender === "MALE" ? "ذكر" : b.gender === "FEMALE" ? "أنثى" : "",
      city: b.city ?? "",
      neighborhood: b.neighborhood ?? "",
      association: b.association?.name ?? b.associationOther ?? "",
      dependentsCount: b.dependentsCount,
      familySize: householdSize(b.dependentsCount),
      status: STATUS_LABELS[status],
      checkedInAt: attendance?.checkedInAt?.toISOString() ?? "",
      receivedAt: latest?.createdAt?.toISOString() ?? "",
      pieces: piecesTotal,
      exceptionReason: attendance?.exceptionReason ?? "",
      entitlementOverride: latest?.entitledOverride ?? null,
      overrideReason: latest?.overrideReason ?? "",
    };
  });

  const breakdowns = buildBreakdownShares({
    associations: rows.map((r) => r.association),
    neighborhoods: rows.map((r) => r.neighborhood),
    cities: rows.map((r) => r.city),
    genders: rows.map((r) => r.gender),
    dependentsCounts: rows.map((r) => r.dependentsCount),
  });

  const byGender = sharesToRecord(breakdowns.byGender);
  const byCity = sharesToRecord(breakdowns.byCity);
  const byNeighborhood = sharesToRecord(breakdowns.byNeighborhood);
  const byFamilySize = sharesToRecord(breakdowns.households.byHouseholdSize);
  const byAssociation = sharesToRecord(breakdowns.byAssociation);

  if ((format === "xlsx" || format === "pdf") && !exportFullIdentity) {
    return NextResponse.json(
      { error: "تصدير الهوية والجوال الكامل مقصور على المدير" },
      { status: 403 },
    );
  }

  const safeRows = redactIdentityFields(rows, exportFullIdentity);

  /** نطاق اليوم بتوقيت الرياض — إن وُجد يُصفّي كل المؤشرات القابلة للتأريخ */
  const dayBounds = selectedDayRef
    ? riyadhDayBounds(selectedDayRef.dateKey)
    : null;
  const createdAtDay = dayBounds
    ? { gte: dayBounds.start, lt: dayBounds.end }
    : undefined;
  const inviteDateDay = createdAtDay;
  const checkedInDay = createdAtDay;

  const [
    invited,
    attendedRows,
    received,
    exceptionAttendance,
    overrideDispenses,
    piecesAgg,
    inventoryRemaining,
    topItems,
    storeSummaryDay,
    storeSummaryFull,
    platformStockDay,
    platformStockFull,
    volunteers,
    dayInvites,
    dayAttendances,
    dispenseLines,
  ] = await Promise.all([
    prisma.exhibitionInvite.count({
      where: {
        exhibitionId,
        invited: true,
        ...(inviteDateDay ? { inviteDate: inviteDateDay } : {}),
      },
    }),
    prisma.attendance.findMany({
      where: {
        exhibitionId,
        ...(checkedInDay ? { checkedInAt: checkedInDay } : {}),
      },
      select: {
        beneficiaryId: true,
        type: true,
        beneficiary: { select: { dependentsCount: true } },
      },
    }),
    countDistinctReceived(
      exhibitionId,
      dayBounds
        ? { dayStart: dayBounds.start, dayEnd: dayBounds.end }
        : undefined,
    ),
    prisma.attendance.count({
      where: {
        exhibitionId,
        type: "EXCEPTION",
        ...(checkedInDay ? { checkedInAt: checkedInDay } : {}),
      },
    }),
    prisma.dispenseOrder.count({
      where: {
        exhibitionId,
        entitledOverride: { not: null },
        ...(createdAtDay ? { createdAt: createdAtDay } : {}),
      },
    }),
    prisma.dispenseOrder.aggregate({
      where: {
        exhibitionId,
        ...(createdAtDay ? { createdAt: createdAtDay } : {}),
      },
      _sum: { piecesCount: true },
    }),
    prisma.inventoryItem.findMany({
      where: { exhibitionId },
      select: { attributesJson: true, quantity: true, skuCode: true },
    }),
    fetchTopDispensedItems(
      exhibitionId,
      5,
      dayBounds
        ? { dayStart: dayBounds.start, dayEnd: dayBounds.end }
        : undefined,
    ),
    summarizeStoreStock(
      prisma,
      exhibitionId,
      dayBounds
        ? { dayStart: dayBounds.start, dayEnd: dayBounds.end }
        : undefined,
    ),
    summarizeStoreStock(prisma, exhibitionId),
    summarizePlatformStock(
      prisma,
      exhibitionId,
      dayBounds
        ? { dayStart: dayBounds.start, dayEnd: dayBounds.end }
        : undefined,
    ),
    summarizePlatformStock(prisma, exhibitionId),
    prisma.volunteer.count({ where: { exhibitionId } }),
    prisma.exhibitionInvite.findMany({
      where: { exhibitionId, invited: true },
      select: { beneficiaryId: true, inviteDate: true },
    }),
    prisma.attendance.findMany({
      where: { exhibitionId },
      select: { beneficiaryId: true, checkedInAt: true },
    }),
    prisma.dispenseLine.findMany({
      where: {
        dispenseOrder: {
          exhibitionId,
          ...(createdAtDay ? { createdAt: createdAtDay } : {}),
        },
      },
      select: {
        quantity: true,
        inventoryItem: { select: { attributesJson: true } },
      },
    }),
  ]);

  const { clothesPieces, fabricMeters } = sumDispensedByKind(
    dispenseLines.map((line) => ({
      quantity: line.quantity,
      attributes: (line.inventoryItem.attributesJson ?? {}) as Record<
        string,
        unknown
      >,
    })),
  );

  const attended = attendedRows.length;
  const { attendedFamilies, attendedIndividuals } =
    countAttendanceFamiliesAndIndividuals(
      attendedRows.map((a) => a.beneficiary.dependentsCount),
    );

  const daily = buildDailyReportMetrics({
    days,
    invites: dayInvites,
    attendances: dayAttendances,
  });
  const selectedDay = selectedDayRef
    ? daily.byDay.find((d) => d.dateKey === selectedDayRef.dateKey) ?? null
    : null;

  /** المتبقي دائماً إجمالي المعرض؛ المضاف/المصروف يتبعان نطاق اليوم */
  const storeSummary = dayBounds
    ? storeSummaryDay.map((row) => {
        const full = storeSummaryFull.find(
          (f) =>
            f.storeId === row.storeId &&
            f.inventoryItemId === row.inventoryItemId,
        );
        return { ...row, remaining: full?.remaining ?? row.remaining };
      })
    : storeSummaryFull;

  const platformContributed = dayBounds
    ? platformStockDay.added
    : platformStockFull.added;
  const platformDispensed = dayBounds
    ? platformStockDay.dispensed
    : platformStockFull.dispensed;
  const platformRemaining = platformStockFull.remaining;
  const storeContributed = (dayBounds ? storeSummaryDay : storeSummaryFull).reduce(
    (s, r) => s + r.added,
    0,
  );
  const storeDispensedQty = (dayBounds ? storeSummaryDay : storeSummaryFull).reduce(
    (s, r) => s + r.dispensed,
    0,
  );
  const storeRemaining = storeSummaryFull.reduce((s, r) => s + r.remaining, 0);

  let scopedBeneficiaryFamilies = breakdowns.households.beneficiaryFamilies;
  let scopedTotalIndividuals = breakdowns.households.totalIndividuals;
  let scopedByGender = byGender;
  let scopedByCity = byCity;
  let scopedByNeighborhood = byNeighborhood;
  let scopedByFamilySize = byFamilySize;
  let scopedByAssociation = byAssociation;
  let scopedByGenderShares = breakdowns.byGender;
  let scopedByCityShares = breakdowns.byCity;
  let scopedByNeighborhoodShares = breakdowns.byNeighborhood;
  let scopedByAssociationShares = breakdowns.byAssociation;
  let scopedByHouseholdSizeShares = breakdowns.households.byHouseholdSize;

  if (dayBounds) {
    const attendedIds = new Set(attendedRows.map((a) => a.beneficiaryId));
    const attendedBeneficiaries = beneficiaries.filter((b) =>
      attendedIds.has(b.id),
    );
    const dayBreakdowns = buildBreakdownShares({
      associations: attendedBeneficiaries.map(
        (b) => b.association?.name ?? b.associationOther ?? "",
      ),
      neighborhoods: attendedBeneficiaries.map((b) => b.neighborhood ?? ""),
      cities: attendedBeneficiaries.map((b) => b.city ?? ""),
      genders: attendedBeneficiaries.map((b) =>
        b.gender === "MALE" ? "ذكر" : b.gender === "FEMALE" ? "أنثى" : "",
      ),
      dependentsCounts: attendedBeneficiaries.map((b) => b.dependentsCount),
    });
    scopedBeneficiaryFamilies = dayBreakdowns.households.beneficiaryFamilies;
    scopedTotalIndividuals = dayBreakdowns.households.totalIndividuals;
    scopedByGender = sharesToRecord(dayBreakdowns.byGender);
    scopedByCity = sharesToRecord(dayBreakdowns.byCity);
    scopedByNeighborhood = sharesToRecord(dayBreakdowns.byNeighborhood);
    scopedByFamilySize = sharesToRecord(
      dayBreakdowns.households.byHouseholdSize,
    );
    scopedByAssociation = sharesToRecord(dayBreakdowns.byAssociation);
    scopedByGenderShares = dayBreakdowns.byGender;
    scopedByCityShares = dayBreakdowns.byCity;
    scopedByNeighborhoodShares = dayBreakdowns.byNeighborhood;
    scopedByAssociationShares = dayBreakdowns.byAssociation;
    scopedByHouseholdSizeShares = dayBreakdowns.households.byHouseholdSize;
  }

  const summary = {
    exhibitionId: exhibition.id,
    exhibitionName: exhibition.name,
    exhibitionActive: exhibition.active,
    totalBeneficiaries: dayBounds
      ? scopedBeneficiaryFamilies
      : beneficiaries.length,
    invited,
    attended,
    attendedFamilies,
    attendedIndividuals,
    received,
    volunteers,
    exceptionAttendance,
    overrideDispenses,
    piecesDispensed: piecesAgg._sum.piecesCount ?? 0,
    clothesPieces,
    fabricMeters,
    inventoryRemaining: inventoryRemaining.map((i) => ({
      skuCode: i.skuCode,
      attributes: i.attributesJson,
      quantity: Number(i.quantity),
    })),
    inventoryRemainingTotal: inventoryRemaining.reduce(
      (s, i) => s + Number(i.quantity),
      0,
    ),
    storeSummary,
    storeContributed,
    storeDispensed: storeDispensedQty,
    storeRemaining,
    platformContributed,
    platformDispensed,
    platformRemaining,
    remainingIsExhibitionTotal: Boolean(dayBounds),
    beneficiaryFamilies: scopedBeneficiaryFamilies,
    totalIndividuals: scopedTotalIndividuals,
    byGender: scopedByGender,
    byCity: scopedByCity,
    byNeighborhood: scopedByNeighborhood,
    byFamilySize: scopedByFamilySize,
    byAssociation: scopedByAssociation,
    byGenderShares: scopedByGenderShares,
    byCityShares: scopedByCityShares,
    byNeighborhoodShares: scopedByNeighborhoodShares,
    byAssociationShares: scopedByAssociationShares,
    byHouseholdSizeShares: scopedByHouseholdSizeShares,
    topItems,
    attributeLabels: attributeLabelsFromSchema(
      parseInventorySchema(exhibition.settings?.inventorySchemaJson),
    ),
    days,
    byDay: daily.byDay,
    invitedWithoutDate: daily.invitedWithoutDate,
    attendedOutsideDays: daily.attendedOutsideDays,
    selectedDayKey: selectedDay?.dateKey ?? null,
    selectedDay,
  };

  if (format === "json") {
    return NextResponse.json({
      summary,
      rows: safeRows,
      identityFieldsRedacted: !exportFullIdentity,
    });
  }

  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    const summarySheet = wb.addWorksheet("ملخص");
    summarySheet.addRows([
      ["المؤشر", "القيمة"],
      ["المعرض", exhibition.name],
      ["إجمالي المستفيدين (أفراد)", summary.totalIndividuals],
      ["الأسر المستفيدة", summary.beneficiaryFamilies],
      ["المدعوون", summary.invited],
      ["الحضور من الأسر", summary.attendedFamilies ?? summary.attended],
      ["الحضور من الأفراد", summary.attendedIndividuals ?? summary.attended],
      ["المستلمون", summary.received],
      ["المتطوعون", summary.volunteers ?? 0],
      ["القطع المصروفة (إجمالي)", summary.piecesDispensed],
      ["ملابس مصروفة (قطع)", summary.clothesPieces],
      ["أقمشة مصروفة (متر)", summary.fabricMeters],
      ["مضاف من المنصة", summary.platformContributed],
      ["مصروف من المنصة", summary.platformDispensed],
      ["متبقي للمنصة", summary.platformRemaining],
      ["مساهمات المتاجر (مضاف)", summary.storeContributed],
      ["مصروف من المتاجر", summary.storeDispensed],
      ["متبقي للمتاجر", summary.storeRemaining],
      ["متبقي المخزون (إجمالي)", summary.inventoryRemainingTotal],
    ]);

    const storesSheet = wb.addWorksheet("المتاجر");
    storesSheet.addRow(["المتجر", "الرمز", "مضاف", "مصروف", "مرتجع", "متبقي"]);
    for (const r of summary.storeSummary) {
      storesSheet.addRow([r.storeName, r.skuCode, r.added, r.dispensed, r.returned, r.remaining]);
    }

    const detail = wb.addWorksheet("التفاصيل");
    detail.addRow([
      "الاسم",
      "الهوية",
      "الجوال",
      "الجنس",
      "المدينة",
      "الحي",
      "الجمعية",
      "عدد التابعين",
      "حجم الأسرة",
      "الحالة",
      "وقت الحضور",
      "وقت الاستلام",
      "القطع",
      "سبب الاستثناء",
      "استثناء الاستحقاق",
      "سبب رفع الاستحقاق",
    ]);

    const MAX_ROWS_PER_SHEET = 5000;
    let sheetIndex = 1;
    let current = detail;
    let countInSheet = 0;
    for (const r of safeRows) {
      if (countInSheet >= MAX_ROWS_PER_SHEET) {
        sheetIndex++;
        current = wb.addWorksheet(`التفاصيل_${sheetIndex}`);
        current.addRow([
          "الاسم",
          "الهوية",
          "الجوال",
          "الجنس",
          "المدينة",
          "الحي",
          "الجمعية",
          "عدد التابعين",
          "حجم الأسرة",
          "الحالة",
          "وقت الحضور",
          "وقت الاستلام",
          "القطع",
          "سبب الاستثناء",
          "استثناء الاستحقاق",
          "سبب رفع الاستحقاق",
        ]);
        countInSheet = 0;
      }
      current.addRow([
        r.name,
        r.nationalId,
        r.mobile,
        r.gender,
        r.city,
        r.neighborhood,
        r.association,
        r.dependentsCount,
        r.familySize,
        r.status,
        r.checkedInAt,
        r.receivedAt,
        r.pieces,
        r.exceptionReason,
        r.entitlementOverride ?? "",
        r.overrideReason,
      ]);
      countInSheet++;
    }

    const addShareSheet = (name: string, rowsShare: typeof breakdowns.byAssociation) => {
      const sheet = wb.addWorksheet(name);
      sheet.addRow(["الفئة", "العدد", "النسبة %"]);
      rowsShare.forEach((r) => sheet.addRow([r.key, r.count, r.percent]));
    };
    addShareSheet("حسب الجمعية", breakdowns.byAssociation);
    addShareSheet("حسب عدد الأفراد", breakdowns.households.byHouseholdSize);
    addShareSheet("حسب الحي", breakdowns.byNeighborhood);
    addShareSheet("حسب الجنس", breakdowns.byGender);
    addShareSheet("حسب المدينة", breakdowns.byCity);

    const topSheet = wb.addWorksheet("أعلى 5 قطع");
    topSheet.addRow(["الترتيب", "الكمية", "السمات"]);
    topItems.forEach((t, i) =>
      topSheet.addRow([i + 1, t.quantity, JSON.stringify(t.attributes)]),
    );

    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(buf, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="ridaa-report.xlsx"`,
      },
    });
  }

  if (format === "pdf") {
    const pageSize = 40;
    const sections: string[] = [];

    const shareTable = (title: string, shares: typeof breakdowns.byAssociation) => `
      <section>
        <h2>${escapeHtml(title)}</h2>
        <table>
          <thead><tr><th>الفئة</th><th>العدد</th><th>النسبة</th></tr></thead>
          <tbody>
            ${shares
              .map(
                (r) =>
                  `<tr><td>${escapeHtml(r.key)}</td><td>${r.count}</td><td>${r.percent}%</td></tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </section>`;

    sections.push(shareTable("التوزيع حسب الجمعية", breakdowns.byAssociation));
    sections.push(shareTable("التوزيع حسب الحي", breakdowns.byNeighborhood));
    sections.push(
      shareTable("توزيع عدد الأفراد", breakdowns.households.byHouseholdSize),
    );
    sections.push(`
      <section>
        <h2>أعلى 5 قطع مصروفة</h2>
        <table>
          <thead><tr><th>#</th><th>الكمية</th><th>السمات</th></tr></thead>
          <tbody>
            ${topItems
              .map(
                (t, i) =>
                  `<tr><td>${i + 1}</td><td>${t.quantity}</td><td>${escapeHtml(JSON.stringify(t.attributes))}</td></tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </section>`);

    for (let i = 0; i < safeRows.length; i += pageSize) {
      const slice = safeRows.slice(i, i + pageSize);
      const isLast = i + pageSize >= safeRows.length;
      sections.push(`
        <section class="${isLast ? "" : "page-break"}">
          <h2>تفاصيل المستفيدين — صفحة ${Math.floor(i / pageSize) + 1}</h2>
          <table>
            <thead>
              <tr>
                <th>الاسم</th><th>الهوية</th><th>الجوال</th><th>الحالة</th><th>القطع</th>
              </tr>
            </thead>
            <tbody>
              ${slice
                .map(
                  (r) =>
                    `<tr><td>${escapeHtml(r.name)}</td><td class="ltr">${escapeHtml(r.nationalId)}</td><td class="ltr">${escapeHtml(r.mobile)}</td><td>${escapeHtml(r.status)}</td><td>${r.pieces}</td></tr>`,
                )
                .join("")}
            </tbody>
          </table>
        </section>
      `);
    }

    const html = buildPrintDocument({
      title: `تقرير معرض: ${exhibition.name}`,
      subtitle: exhibition.active ? "المعرض النشط حالياً" : "معرض غير نشط (أرشيف)",
      tiles: [
        { label: "إجمالي المستفيدين (أفراد)", value: summary.totalIndividuals },
        { label: "الأسر المستفيدة", value: summary.beneficiaryFamilies },
        { label: "المدعوون", value: summary.invited },
        { label: "الحضور من الأسر", value: summary.attendedFamilies ?? summary.attended },
        { label: "الحضور من الأفراد", value: summary.attendedIndividuals ?? summary.attended },
        { label: "استلموا", value: summary.received },
        { label: "المتطوعون", value: summary.volunteers ?? 0 },
        { label: "القطع المصروفة", value: summary.piecesDispensed },
        { label: "ملابس مصروفة (قطع)", value: summary.clothesPieces },
        { label: "أقمشة مصروفة (متر)", value: summary.fabricMeters },
        { label: "حضور استثنائي", value: summary.exceptionAttendance },
        { label: "صرف استثنائي", value: summary.overrideDispenses },
      ],
      sectionsHtml: sections.join("\n"),
    });

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return NextResponse.json({ error: "صيغة غير مدعومة" }, { status: 400 });
}

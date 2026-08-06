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
import { buildZadPresentationReport } from "@/lib/zad-presentation-report";

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

  const [
    invited,
    attended,
    receivedGroups,
    exceptionAttendance,
    overrideDispenses,
    piecesAgg,
    inventoryRemaining,
    topItems,
  ] = await Promise.all([
    prisma.exhibitionInvite.count({ where: { exhibitionId, invited: true } }),
    prisma.attendance.count({ where: { exhibitionId } }),
    prisma.dispenseOrder.groupBy({
      by: ["beneficiaryId"],
      where: { exhibitionId },
    }),
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
    prisma.inventoryItem.findMany({ where: { exhibitionId } }),
    fetchTopDispensedItems(exhibitionId, 5),
  ]);

  const summary = {
    exhibitionId: exhibition.id,
    exhibitionName: exhibition.name,
    exhibitionActive: exhibition.active,
    totalBeneficiaries: beneficiaries.length,
    invited,
    attended,
    received: receivedGroups.length,
    exceptionAttendance,
    overrideDispenses,
    piecesDispensed: piecesAgg._sum.piecesCount ?? 0,
    inventoryRemaining: inventoryRemaining.map((i) => ({
      attributes: i.attributesJson,
      quantity: Number(i.quantity),
    })),
    beneficiaryFamilies: breakdowns.households.beneficiaryFamilies,
    avgHouseholdSize: breakdowns.households.avgHouseholdSize,
    byGender,
    byCity,
    byNeighborhood,
    byFamilySize,
    byAssociation,
    byGenderShares: breakdowns.byGender,
    byCityShares: breakdowns.byCity,
    byNeighborhoodShares: breakdowns.byNeighborhood,
    byAssociationShares: breakdowns.byAssociation,
    byHouseholdSizeShares: breakdowns.households.byHouseholdSize,
    topItems,
  };

  if (format === "json") {
    return NextResponse.json({
      summary,
      rows: safeRows,
      identityFieldsRedacted: !exportFullIdentity,
    });
  }

  if (format === "presentation") {
    const report = buildZadPresentationReport(summary);
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

  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    const summarySheet = wb.addWorksheet("ملخص");
    summarySheet.addRows([
      ["المؤشر", "القيمة"],
      ["المعرض", exhibition.name],
      ["إجمالي المستفيدين", summary.totalBeneficiaries],
      ["عدد الأسر المستفيدة", summary.beneficiaryFamilies],
      ["متوسط حجم الأسرة", summary.avgHouseholdSize],
      ["المدعوون", summary.invited],
      ["الحضور", summary.attended],
      ["المستلمون", summary.received],
      ["القطع المصروفة", summary.piecesDispensed],
    ]);

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
    addShareSheet("حسب حجم الأسرة", breakdowns.households.byHouseholdSize);
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
      shareTable("توزيع حجم الأسرة", breakdowns.households.byHouseholdSize),
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
        { label: "إجمالي المستفيدين", value: summary.totalBeneficiaries },
        { label: "الأسر المستفيدة", value: summary.beneficiaryFamilies },
        { label: "متوسط حجم الأسرة", value: summary.avgHouseholdSize },
        { label: "المدعوون", value: summary.invited },
        { label: "الحاضرون", value: summary.attended },
        { label: "استلموا", value: summary.received },
        { label: "القطع المصروفة", value: summary.piecesDispensed },
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

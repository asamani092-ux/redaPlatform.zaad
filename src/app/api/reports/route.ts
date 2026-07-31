import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { getActiveExhibition } from "@/lib/exhibition";
import { STATUS_LABELS, resolveStatus } from "@/lib/status";
import { hasPermission } from "@/lib/rbac";
import { canExportFullIdentity, redactIdentityFields } from "@/lib/pii";
import { Role } from "@/generated/prisma/enums";

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
      dispenseOrders: { where: { exhibitionId }, take: 1 },
    },
    orderBy: { name: "asc" },
  });

  const rows = beneficiaries.map((b) => {
    const invite = b.invites[0];
    const attendance = b.attendances[0];
    const dispense = b.dispenseOrders[0];
    const status = resolveStatus({
      invited: invite?.invited,
      attendanceType: attendance?.type ?? null,
      received: !!dispense,
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
      familySize: b.dependentsCount,
      status: STATUS_LABELS[status],
      checkedInAt: attendance?.checkedInAt?.toISOString() ?? "",
      receivedAt: dispense?.createdAt?.toISOString() ?? "",
      pieces: dispense?.piecesCount ?? 0,
      exceptionReason: attendance?.exceptionReason ?? "",
      entitlementOverride: dispense?.entitledOverride ?? null,
      overrideReason: dispense?.overrideReason ?? "",
    };
  });

  const byGender = groupCount(rows.map((r) => r.gender || "غير محدد"));
  const byCity = groupCount(rows.map((r) => r.city || "غير محدد"));
  const byNeighborhood = groupCount(rows.map((r) => r.neighborhood || "غير محدد"));
  const byFamilySize = groupCount(rows.map((r) => String(r.familySize ?? 0)));

  if ((format === "xlsx" || format === "pdf") && !exportFullIdentity) {
    return NextResponse.json(
      { error: "تصدير الهوية والجوال الكامل مقصور على المدير" },
      { status: 403 },
    );
  }

  const safeRows = redactIdentityFields(rows, exportFullIdentity);

  const summary = {
    exhibitionId: exhibition.id,
    exhibitionName: exhibition.name,
    exhibitionActive: exhibition.active,
    totalBeneficiaries: beneficiaries.length,
    invited: await prisma.exhibitionInvite.count({ where: { exhibitionId, invited: true } }),
    attended: await prisma.attendance.count({ where: { exhibitionId } }),
    received: await prisma.dispenseOrder.count({ where: { exhibitionId } }),
    piecesDispensed:
      (
        await prisma.dispenseOrder.aggregate({
          where: { exhibitionId },
          _sum: { piecesCount: true },
        })
      )._sum.piecesCount ?? 0,
    inventoryRemaining: (
      await prisma.inventoryItem.findMany({ where: { exhibitionId } })
    ).map((i) => ({ attributes: i.attributesJson, quantity: Number(i.quantity) })),
    byGender,
    byCity,
    byNeighborhood,
    byFamilySize,
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
      ["إجمالي المستفيدين", summary.totalBeneficiaries],
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

    const familySheet = wb.addWorksheet("حسب حجم الأسرة");
    familySheet.addRow(["عدد التابعين", "العدد"]);
    Object.entries(byFamilySize).forEach(([k, v]) => familySheet.addRow([k, v]));

    const genderSheet = wb.addWorksheet("حسب الجنس");
    genderSheet.addRow(["الجنس", "العدد"]);
    Object.entries(byGender).forEach(([k, v]) => genderSheet.addRow([k, v]));

    const citySheet = wb.addWorksheet("حسب المدينة");
    citySheet.addRow(["المدينة", "العدد"]);
    Object.entries(byCity).forEach(([k, v]) => citySheet.addRow([k, v]));

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
    const pages: string[] = [];
    for (let i = 0; i < safeRows.length; i += pageSize) {
      const slice = safeRows.slice(i, i + pageSize);
      pages.push(`
        <section style="page-break-after: always; font-family: Tahoma, Arial; direction: rtl;">
          <h1>تقرير معرض رداء — ${escapeHtml(exhibition.name)}</h1>
          <p>صفحة ${Math.floor(i / pageSize) + 1}</p>
          <table border="1" cellspacing="0" cellpadding="6" width="100%" style="border-collapse:collapse;font-size:12px;">
            <thead>
              <tr>
                <th>الاسم</th><th>الهوية</th><th>الجوال</th><th>الحالة</th><th>القطع</th>
              </tr>
            </thead>
            <tbody>
              ${slice
                .map(
                  (r) =>
                    `<tr><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.nationalId)}</td><td>${escapeHtml(r.mobile)}</td><td>${escapeHtml(r.status)}</td><td>${r.pieces}</td></tr>`,
                )
                .join("")}
            </tbody>
          </table>
        </section>
      `);
    }

    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>تقرير رداء</title></head><body>
      <h2>الملخص — ${escapeHtml(exhibition.name)}</h2>
      <ul>
        <li>المستفيدون: ${summary.totalBeneficiaries}</li>
        <li>المدعوون: ${summary.invited}</li>
        <li>الحضور: ${summary.attended}</li>
        <li>المستلمون: ${summary.received}</li>
        <li>القطع: ${summary.piecesDispensed}</li>
      </ul>
      ${pages.join("\n")}
      <script>window.onload=()=>window.print()</script>
    </body></html>`;

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return NextResponse.json({ error: "صيغة غير مدعومة" }, { status: 400 });
}

function groupCount(values: string[]) {
  return values.reduce<Record<string, number>>((acc, v) => {
    acc[v] = (acc[v] ?? 0) + 1;
    return acc;
  }, {});
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

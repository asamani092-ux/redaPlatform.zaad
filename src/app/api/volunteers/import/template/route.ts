import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";

/**
 * نموذج Excel لاستيراد المتطوعين — O(r) لعرض المهام المتاحة.
 * الأعمدة متوافقة مع aliases في مسار الاستيراد.
 */
export async function GET() {
  const authz = await requirePermission("volunteers:manage");
  if ("error" in authz) return authz.error;

  const roles = await prisma.volunteerRoleOption.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { name: true },
  });
  const roleNames = roles.map((r) => r.name).join("، ") || "تنظيم، استقبال، صرف، مخزون";

  const wb = new ExcelJS.Workbook();
  wb.creator = "منصة رداء";

  const guide = wb.addWorksheet("تعليمات");
  guide.getColumn(1).width = 78;
  [
    "تعليمات استيراد المتطوعين",
    "1) عبّئ ورقة «المتطوعون» — لا تغيّر عناوين الصف الأول.",
    "2) رقم الهوية: من 10 إلى 14 رقماً (أرقام فقط).",
    "3) رقم الجوال: 05xxxxxxxx (اكتب الجوال كنص إن حذف Excel الصفر).",
    "4) المهام: افصل بين أكثر من مهمة بفاصلة (مثال: تنظيم، صرف).",
    `5) المهام المتاحة حالياً: ${roleNames}`,
    "6) الفريق التطوعي اختياري.",
    "7) احذف صف المثال قبل الرفع أو عدّل بياناته لقيم حقيقية غير مكررة.",
  ].forEach((line, i) => {
    guide.getRow(i + 1).getCell(1).value = line;
    if (i === 0) guide.getRow(i + 1).font = { bold: true, size: 14 };
  });

  const sheet = wb.addWorksheet("المتطوعون");
  const headers = ["الاسم", "رقم الهوية", "رقم الجوال", "المهام", "الفريق التطوعي"];
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  const example = sheet.addRow([
    "مثال محمد",
    "1000000008",
    "0500000001",
    roles.length ? roles.slice(0, 2).map((r) => r.name).join("، ") : "تنظيم، صرف",
    "فريق الاستقبال",
  ]);
  sheet.getColumn(2).numFmt = "@";
  sheet.getColumn(3).numFmt = "@";
  example.getCell(2).numFmt = "@";
  example.getCell(3).numFmt = "@";
  const widths = [18, 16, 16, 24, 20];
  headers.forEach((_, i) => {
    sheet.getColumn(i + 1).width = widths[i] ?? 16;
  });

  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="ridaa-volunteers-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}

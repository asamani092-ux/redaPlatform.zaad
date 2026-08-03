import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requirePermission } from "@/lib/session";

/**
 * نموذج Excel فارغ للتعبئة ثم الرفع — O(1).
 * الأعمدة متوافقة مع aliases في مسار الاستيراد.
 */
export async function GET() {
  const authz = await requirePermission("beneficiaries:manage");
  if ("error" in authz) return authz.error;

  const wb = new ExcelJS.Workbook();
  wb.creator = "منصة رداء";

  const guide = wb.addWorksheet("تعليمات");
  guide.getColumn(1).width = 72;
  [
    "تعليمات استيراد المستفيدين",
    "1) عبّئ ورقة «المستفيدون» — لا تغيّر عناوين الصف الأول.",
    "2) رقم الهوية: من 10 إلى 14 رقماً (أرقام فقط).",
    "3) رقم الجوال: 05xxxxxxxx (اكتب الجوال كنص إن حذف Excel الصفر).",
    "4) احذف صف المثال قبل الرفع أو عدّل بياناته لقيم حقيقية غير مكررة.",
    "5) أمثلة: 1000000008 أو 12345678901234",
  ].forEach((line, i) => {
    guide.getRow(i + 1).getCell(1).value = line;
    if (i === 0) guide.getRow(i + 1).font = { bold: true, size: 14 };
  });

  const sheet = wb.addWorksheet("المستفيدون");
  const headers = [
    "الاسم",
    "رقم الهوية",
    "رقم الجوال",
    "الجنس",
    "المدينة",
    "الحي",
    "الجمعية",
    "عدد التابعين",
    "ملاحظات",
  ];
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  // صف مثال بهوية وجوال صالحين — يُستبدل عند التعبئة
  const example = sheet.addRow([
    "مثال أحمد",
    "1000000008",
    "0500000001",
    "ذكر",
    "الرياض",
    "النخيل",
    "",
    "3",
    "",
  ]);
  // فرض نص على أعمدة الهوية والجوال حتى لا يحذف Excel الأصفار
  sheet.getColumn(2).numFmt = "@";
  sheet.getColumn(3).numFmt = "@";
  example.getCell(2).numFmt = "@";
  example.getCell(3).numFmt = "@";
  headers.forEach((_, i) => {
    sheet.getColumn(i + 1).width = 16;
  });

  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="ridaa-beneficiaries-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}

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
  sheet.addRow(["مثال أحمد", "1000000008", "0500000001", "ذكر", "الرياض", "النخيل", "", "3", ""]);
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

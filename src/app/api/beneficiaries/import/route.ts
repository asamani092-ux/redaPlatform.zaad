import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { isValidSaudiNationalId, normalizeNationalId } from "@/lib/national-id";
import { writeAuditLog } from "@/lib/audit";
import { Gender } from "@/generated/prisma/enums";

function cellStr(v: ExcelJS.CellValue | undefined): string {
  if (v == null) return "";
  if (typeof v === "object" && "text" in v) return String(v.text ?? "");
  return String(v).trim();
}

export async function POST(req: NextRequest) {
  const authz = await requirePermission("beneficiaries:manage");
  if ("error" in authz) return authz.error;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "الملف مطلوب" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const wb = new ExcelJS.Workbook();
  // exceljs typings conflict with Node Buffer generics
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = wb.worksheets[0];
  if (!sheet) {
    return NextResponse.json({ error: "الورقة فارغة" }, { status: 400 });
  }

  const headerRow = sheet.getRow(1);
  const headers: Record<string, number> = {};
  headerRow.eachCell((cell, col) => {
    headers[cellStr(cell.value).toLowerCase()] = col;
  });

  const col = (aliases: string[]) => {
    for (const a of aliases) {
      if (headers[a]) return headers[a]!;
    }
    return null;
  };

  const nameCol = col(["name", "الاسم", "اسم"]);
  const idCol = col(["nationalid", "national_id", "الهوية", "رقم الهوية", "هوية"]);
  const mobileCol = col(["mobile", "phone", "الجوال", "رقم الجوال"]);
  if (!nameCol || !idCol || !mobileCol) {
    return NextResponse.json(
      { error: "الأعمدة المطلوبة: الاسم، رقم الهوية، رقم الجوال" },
      { status: 400 },
    );
  }

  const genderCol = col(["gender", "الجنس"]);
  const cityCol = col(["city", "المدينة"]);
  const neighborhoodCol = col(["neighborhood", "الحي"]);
  const associationCol = col(["association", "الجمعية", "اسم الجمعية"]);
  const notesCol = col(["notes", "ملاحظات"]);
  const dependentsCol = col([
    "dependents",
    "dependents_count",
    "dependentscount",
    "التابعون",
    "عدد التابعين",
    "حجم الأسرة",
    "افراد الاسرة",
    "أفراد الأسرة",
  ]);

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const name = cellStr(row.getCell(nameCol).value);
    const nationalId = normalizeNationalId(cellStr(row.getCell(idCol).value));
    const mobile = cellStr(row.getCell(mobileCol).value);
    if (!name && !nationalId && !mobile) continue;

    if (!isValidSaudiNationalId(nationalId)) {
      skipped++;
      errors.push(`صف ${r}: هوية غير صالحة (${nationalId || "فارغ"})`);
      continue;
    }

    const exists = await prisma.beneficiary.findUnique({ where: { nationalId } });
    if (exists) {
      skipped++;
      errors.push(`صف ${r}: مكرر (${nationalId})`);
      continue;
    }

    let associationId: string | null = null;
    let associationOther: string | null = null;
    if (associationCol) {
      const assocName = cellStr(row.getCell(associationCol).value);
      if (assocName) {
        const opt = await prisma.associationOption.findFirst({
          where: { name: assocName },
        });
        if (opt) associationId = opt.id;
        else associationOther = assocName;
      }
    }

    const genderRaw = genderCol ? cellStr(row.getCell(genderCol).value) : "";
    let gender: Gender | null = null;
    if (["MALE", "ذكر", "م"].includes(genderRaw)) gender = Gender.MALE;
    if (["FEMALE", "أنثى", "انثى", "ف"].includes(genderRaw)) gender = Gender.FEMALE;

    const depsRaw = dependentsCol ? cellStr(row.getCell(dependentsCol).value) : "0";
    const dependentsCount = Math.max(0, Number.parseInt(depsRaw || "0", 10) || 0);

    await prisma.beneficiary.create({
      data: {
        name,
        nationalId,
        mobile,
        gender,
        city: cityCol ? cellStr(row.getCell(cityCol).value) || null : null,
        neighborhood: neighborhoodCol
          ? cellStr(row.getCell(neighborhoodCol).value) || null
          : null,
        notes: notesCol ? cellStr(row.getCell(notesCol).value) || null : null,
        associationId,
        associationOther,
        dependentsCount,
      },
    });
    created++;
  }

  await writeAuditLog({
    userId: authz.userId,
    action: "IMPORT",
    entityType: "Beneficiary",
    meta: { created, skipped, errors: errors.slice(0, 50) },
  });

  return NextResponse.json({ created, skipped, errors: errors.slice(0, 100) });
}

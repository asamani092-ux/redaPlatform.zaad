import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { isValidSaudiNationalId, normalizeNationalId } from "@/lib/national-id";
import { writeAuditLog } from "@/lib/audit";
import { Gender } from "@/generated/prisma/enums";
import { normalizeDigits } from "@/lib/num";

/**
 * قراءة قيمة خلية Excel كنص مستقر — O(1).
 * الأرقام تُحوَّل بدون فاصلة عشرية/صيغة علمية حتى لا تُفسَد الهوية والجوال.
 */
function cellStr(v: ExcelJS.CellValue | undefined): string {
  if (v == null) return "";
  if (typeof v === "number" && Number.isFinite(v)) {
    return Number.isInteger(v) ? String(v) : String(Math.trunc(v));
  }
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "string") return v.trim();
  if (typeof v === "object") {
    if ("result" in v && v.result != null) return cellStr(v.result as ExcelJS.CellValue);
    if ("text" in v) return String((v as { text?: string }).text ?? "").trim();
    if ("richText" in v && Array.isArray((v as { richText: { text: string }[] }).richText)) {
      return (v as { richText: { text: string }[] }).richText.map((t) => t.text).join("").trim();
    }
  }
  return String(v).trim();
}

function normalizeMobile(raw: string): string {
  let m = normalizeDigits(raw).replace(/[^\d+]/g, "");
  if (m.startsWith("00966")) m = `0${m.slice(5)}`;
  if (m.startsWith("+966")) m = `0${m.slice(4)}`;
  if (m.startsWith("966") && m.length >= 12) m = `0${m.slice(3)}`;
  // Excel يحذف صفر البداية أحياناً: 5xxxxxxxx → 05xxxxxxxx
  if (/^5\d{8}$/.test(m)) m = `0${m}`;
  return m;
}

export async function POST(req: NextRequest) {
  const authz = await requirePermission("beneficiaries:manage");
  if ("error" in authz) return authz.error;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "الملف مطلوب" }, { status: 400 });
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "تعذر قراءة الملف" }, { status: 400 });
  }

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    return NextResponse.json(
      { error: "تعذر فتح الملف — استخدم نموذج Excel (.xlsx) من زر التحميل" },
      { status: 400 },
    );
  }

  const sheet = wb.worksheets[0];
  if (!sheet) {
    return NextResponse.json({ error: "الورقة فارغة" }, { status: 400 });
  }

  const headerRow = sheet.getRow(1);
  const headers: Record<string, number> = {};
  headerRow.eachCell((cell, col) => {
    const key = normalizeDigits(cellStr(cell.value)).toLowerCase().replace(/\s+/g, " ").trim();
    if (key) headers[key] = col;
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
    const found = Object.keys(headers).join("، ") || "لا عناوين";
    return NextResponse.json(
      {
        error: `الأعمدة المطلوبة غير موجودة: الاسم، رقم الهوية، رقم الجوال. العناوين في الملف: ${found}`,
        errors: [`الأعمدة الموجودة: ${found}`],
      },
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
  const lastRow = Math.max(sheet.rowCount, sheet.actualRowCount ?? 0);

  for (let r = 2; r <= lastRow; r++) {
    const row = sheet.getRow(r);
    const name = cellStr(row.getCell(nameCol).value);
    const nationalId = normalizeNationalId(
      normalizeDigits(cellStr(row.getCell(idCol).value)).replace(/[^\d]/g, ""),
    );
    const mobile = normalizeMobile(cellStr(row.getCell(mobileCol).value));
    if (!name && !nationalId && !mobile) continue;

    if (!name.trim()) {
      skipped++;
      errors.push(`صف ${r}: الاسم مطلوب`);
      continue;
    }

    if (!isValidSaudiNationalId(nationalId)) {
      skipped++;
      errors.push(
        `صف ${r}: رقم الهوية غير صالح (${nationalId || "فارغ"}) — يجب 10 أرقام تبدأ بـ 1 أو 2 وتمر بخوارزمية التحقق`,
      );
      continue;
    }

    if (!/^05\d{8}$/.test(mobile)) {
      skipped++;
      errors.push(`صف ${r}: رقم الجوال غير صالح (${mobile || "فارغ"}) — الصيغة: 05xxxxxxxx`);
      continue;
    }

    const exists = await prisma.beneficiary.findUnique({ where: { nationalId } });
    if (exists) {
      skipped++;
      errors.push(`صف ${r}: الهوية مكررة مسبقاً (${nationalId}) — ${exists.name}`);
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

    const depsRaw = dependentsCol
      ? normalizeDigits(cellStr(row.getCell(dependentsCol).value))
      : "0";
    const dependentsCount = Math.max(0, Number.parseInt(depsRaw || "0", 10) || 0);

    try {
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
    } catch (e) {
      skipped++;
      errors.push(
        `صف ${r}: فشل الحفظ — ${e instanceof Error ? e.message : "خطأ غير معروف"}`,
      );
    }
  }

  if (created === 0 && skipped === 0) {
    return NextResponse.json(
      {
        created: 0,
        skipped: 0,
        error: "لا صفوف بيانات في الملف — تأكد أن الصف 1 عناوين والبيانات من الصف 2",
        errors: ["لا صفوف بيانات في الملف"],
      },
      { status: 400 },
    );
  }

  await writeAuditLog({
    userId: authz.userId,
    action: "IMPORT",
    entityType: "Beneficiary",
    meta: { created, skipped, errors: errors.slice(0, 50) },
  });

  const summary =
    created === 0
      ? `لم يُستورد أي مستفيد — تُجوّز ${skipped}. راجع الأسباب أدناه.`
      : `استيراد: ${created} ناجح / ${skipped} متجاوز`;

  return NextResponse.json({
    created,
    skipped,
    errors: errors.slice(0, 100),
    message: summary,
    // إن فشل الكل نُبقي 200 مع created=0 ليظهر التفصيل في الواجهة
    ok: created > 0,
  });
}

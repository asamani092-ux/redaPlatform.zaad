import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { requireActiveExhibition } from "@/lib/exhibition";
import { isValidNationalId, normalizeNationalId } from "@/lib/national-id";
import { writeAuditLog } from "@/lib/audit";
import { normalizeDigits } from "@/lib/num";

/**
 * قراءة قيمة خلية Excel كنص مستقر — O(1).
 * الأرقام تُحوَّل بدون فاصلة/صيغة علمية حتى لا تُفسَد الهوية والجوال.
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
  if (/^5\d{8}$/.test(m)) m = `0${m}`;
  return m;
}

/** تقسيم نص المهام على الفواصل العربية/اللاتينية — O(k) */
function splitTasks(raw: string): string[] {
  return raw
    .split(/[،,\/|]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * استيراد متطوعي المعرض النشط من Excel — تراكمي.
 * Time: O(rows × tasks)؛ Space: O(rows).
 */
export async function POST(req: NextRequest) {
  const authz = await requirePermission("volunteers:manage");
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

  const sheet = wb.worksheets.find((s) => s.name === "المتطوعون") ?? wb.worksheets[0];
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

  const nameCol = col(["name", "الاسم", "اسم", "اسم المتطوع"]);
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

  const tasksCol = col(["tasks", "المهام", "المهمة", "الدور", "الأدوار"]);
  const teamCol = col(["team", "الفريق", "الفريق التطوعي", "فريق"]);

  // خريطة المهام النشطة بالاسم المطبّع لمطابقة سريعة — O(r)
  const roles = await prisma.volunteerRoleOption.findMany({
    where: { active: true },
    select: { id: true, name: true },
  });
  const roleByName = new Map(
    roles.map((r) => [r.name.trim().toLowerCase().replace(/\s+/g, " "), r.id]),
  );

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
    if (!isValidNationalId(nationalId)) {
      skipped++;
      errors.push(
        `صف ${r}: رقم الهوية غير صالح (${nationalId || "فارغ"}) — يجب من 10 إلى 14 رقماً`,
      );
      continue;
    }
    if (!/^05\d{8}$/.test(mobile)) {
      skipped++;
      errors.push(`صف ${r}: رقم الجوال غير صالح (${mobile || "فارغ"}) — الصيغة: 05xxxxxxxx`);
      continue;
    }

    const taskNames = tasksCol ? splitTasks(cellStr(row.getCell(tasksCol).value)) : [];
    if (!taskNames.length) {
      skipped++;
      errors.push(`صف ${r}: عمود المهام مطلوب (مثال: تنظيم، صرف)`);
      continue;
    }
    const taskIds: string[] = [];
    const unknownTasks: string[] = [];
    for (const t of taskNames) {
      const id = roleByName.get(t.toLowerCase().replace(/\s+/g, " "));
      if (id) {
        if (!taskIds.includes(id)) taskIds.push(id);
      } else {
        unknownTasks.push(t);
      }
    }
    if (!taskIds.length) {
      skipped++;
      errors.push(`صف ${r}: لا مهمة معروفة (${unknownTasks.join("، ") || "فارغ"}) — أضف المهام من الإعدادات`);
      continue;
    }

    const exists = await prisma.volunteer.findUnique({
      where: { exhibitionId_nationalId: { exhibitionId: exhibition.id, nationalId } },
      select: { id: true, name: true },
    });
    if (exists) {
      skipped++;
      errors.push(`صف ${r}: متطوع بنفس الهوية مسجّل مسبقاً (${nationalId}) — ${exists.name}`);
      continue;
    }

    const volunteerTeam = teamCol ? cellStr(row.getCell(teamCol).value).trim() || null : null;

    try {
      await prisma.$transaction(async (tx) => {
        const v = await tx.volunteer.create({
          data: {
            exhibitionId: exhibition.id,
            name: name.trim(),
            mobile,
            nationalId,
            volunteerTeam,
            createdById: authz.userId,
          },
        });
        await tx.volunteerTask.createMany({
          data: taskIds.map((roleId) => ({ volunteerId: v.id, roleId })),
        });
      });
      created++;
      if (unknownTasks.length) {
        errors.push(`صف ${r}: أُضيف مع تجاهل مهام غير معروفة (${unknownTasks.join("، ")})`);
      }
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
    entityType: "Volunteer",
    meta: { exhibitionId: exhibition.id, created, skipped, errors: errors.slice(0, 50) },
  });

  const summary =
    created === 0
      ? `لم يُستورد أي متطوع — تُجوّز ${skipped}. راجع الأسباب أدناه.`
      : `استيراد: ${created} ناجح / ${skipped} متجاوز`;

  return NextResponse.json({
    created,
    skipped,
    errors: errors.slice(0, 100),
    message: summary,
    ok: created > 0,
  });
}

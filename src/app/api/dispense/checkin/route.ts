import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";
import { requireActiveExhibition } from "@/lib/exhibition";
import { AttendanceType } from "@/generated/prisma/enums";

const FROM_DISPENSE_REASON = "من شاشة الصرف";

const schema = z.object({
  beneficiaryId: z.string().min(1),
});

/**
 * تحضير (حضور) من شاشة الصرف لصلاحية dispense:manage.
 * Time: O(1) — Space: O(1).
 */
export async function POST(req: NextRequest) {
  const authz = await requirePermission("dispense:manage");
  if ("error" in authz) return authz.error;

  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "حدد المستفيد" }, { status: 400 });
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

  const beneficiary = await prisma.beneficiary.findUnique({
    where: { id: body.data.beneficiaryId },
  });
  if (!beneficiary) {
    return NextResponse.json({ error: "المستفيد غير موجود" }, { status: 404 });
  }

  const existing = await prisma.attendance.findUnique({
    where: {
      exhibitionId_beneficiaryId: {
        exhibitionId: exhibition.id,
        beneficiaryId: beneficiary.id,
      },
    },
  });
  if (existing) {
    return NextResponse.json({
      data: { attendance: existing, beneficiary, alreadyPresent: true },
    });
  }

  try {
    const attendance = await prisma.attendance.create({
      data: {
        exhibitionId: exhibition.id,
        beneficiaryId: beneficiary.id,
        type: AttendanceType.EXCEPTION,
        exceptionReason: FROM_DISPENSE_REASON,
        checkedInById: authz.userId,
      },
    });

    await writeAuditLog({
      userId: authz.userId,
      action: "CHECKIN_FROM_DISPENSE",
      entityType: "Attendance",
      entityId: attendance.id,
      after: attendance,
      meta: {
        beneficiaryId: beneficiary.id,
        nationalId: beneficiary.nationalId,
        source: "dispense",
      },
      status: "PARTIAL",
      statusReason: FROM_DISPENSE_REASON,
    });

    return NextResponse.json({
      data: {
        attendance,
        beneficiary: {
          id: beneficiary.id,
          name: beneficiary.name,
          nationalId: beneficiary.nationalId,
          mobile: beneficiary.mobile,
        },
        alreadyPresent: false,
      },
    });
  } catch {
    return NextResponse.json({ error: "تعذر تسجيل الحضور (ربما مكرر)" }, { status: 409 });
  }
}

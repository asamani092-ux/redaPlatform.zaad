import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";
import { requireActiveExhibition } from "@/lib/exhibition";
import { AttendanceType } from "@/generated/prisma/enums";
import { hasPermission } from "@/lib/rbac";

const checkInSchema = z.object({
  qrToken: z.string().optional(),
  beneficiaryId: z.string().optional(),
  nationalId: z.string().optional(),
  exception: z.boolean().optional(),
  exceptionReason: z.string().optional(),
});

export async function GET() {
  const authz = await requirePermission("attendance:manage");
  if ("error" in authz) return authz.error;
  const exhibition = await requireActiveExhibition();
  const count = await prisma.attendance.count({ where: { exhibitionId: exhibition.id } });
  const recent = await prisma.attendance.findMany({
    where: { exhibitionId: exhibition.id },
    include: { beneficiary: true },
    orderBy: { checkedInAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ count, recent });
}

export async function POST(req: NextRequest) {
  const authz = await requirePermission("attendance:manage");
  if ("error" in authz) return authz.error;

  const body = checkInSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const exhibition = await requireActiveExhibition();
  let beneficiaryId = body.data.beneficiaryId;

  if (body.data.qrToken) {
    const invite = await prisma.exhibitionInvite.findUnique({
      where: { qrToken: body.data.qrToken },
      include: { beneficiary: true },
    });
    if (!invite || invite.exhibitionId !== exhibition.id) {
      return NextResponse.json({ error: "رمز QR غير صالح لهذا المعرض" }, { status: 404 });
    }
    beneficiaryId = invite.beneficiaryId;
  } else if (body.data.nationalId) {
    const b = await prisma.beneficiary.findUnique({
      where: { nationalId: body.data.nationalId.trim() },
    });
    if (!b) return NextResponse.json({ error: "المستفيد غير موجود" }, { status: 404 });
    beneficiaryId = b.id;
  }

  if (!beneficiaryId) {
    return NextResponse.json({ error: "حدد المستفيد أو QR" }, { status: 400 });
  }

  const beneficiary = await prisma.beneficiary.findUnique({ where: { id: beneficiaryId } });
  if (!beneficiary) {
    return NextResponse.json({ error: "المستفيد غير موجود" }, { status: 404 });
  }

  const existing = await prisma.attendance.findUnique({
    where: {
      exhibitionId_beneficiaryId: {
        exhibitionId: exhibition.id,
        beneficiaryId,
      },
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "تم تسجيل الحضور مسبقاً", data: { beneficiary, attendance: existing } },
      { status: 409 },
    );
  }

  const invite = await prisma.exhibitionInvite.findUnique({
    where: {
      exhibitionId_beneficiaryId: {
        exhibitionId: exhibition.id,
        beneficiaryId,
      },
    },
  });

  const isException = !!body.data.exception || !invite?.invited;
  if (isException) {
    if (!hasPermission(authz.role, "attendance:exception") && authz.role !== "ADMIN") {
      // RECEPTION cannot exception — need admin. But plan says supervisor.
      // Only ADMIN has attendance:exception in rbac. Allow ADMIN only unless we add to reception via override request.
      return NextResponse.json(
        { error: "غير مدعو — يلزم صلاحية مشرف مع سبب الاستثناء", beneficiary },
        { status: 403 },
      );
    }
    if (!body.data.exceptionReason?.trim()) {
      return NextResponse.json({ error: "سبب الاستثناء مطلوب" }, { status: 400 });
    }
  }

  try {
    const attendance = await prisma.attendance.create({
      data: {
        exhibitionId: exhibition.id,
        beneficiaryId,
        type: isException ? AttendanceType.EXCEPTION : AttendanceType.NORMAL,
        exceptionReason: isException ? body.data.exceptionReason!.trim() : null,
        checkedInById: authz.userId,
      },
    });

    await writeAuditLog({
      userId: authz.userId,
      action: isException ? "CHECKIN_EXCEPTION" : "CHECKIN",
      entityType: "Attendance",
      entityId: attendance.id,
      after: attendance,
      meta: { beneficiaryId, nationalId: beneficiary.nationalId },
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
      },
    });
  } catch {
    return NextResponse.json({ error: "تعذر تسجيل الحضور (ربما مكرر)" }, { status: 409 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";
import { requireActiveExhibition } from "@/lib/exhibition";
import { AttendanceType } from "@/generated/prisma/enums";
import { hasPermission } from "@/lib/rbac";
import { buildPageMeta, parsePageParams } from "@/lib/pagination";

const checkInSchema = z.object({
  qrToken: z.string().optional(),
  beneficiaryId: z.string().optional(),
  nationalId: z.string().optional(),
  exception: z.boolean().optional(),
  exceptionReason: z.string().optional(),
  /** عدد التابعين الفعلي عند التحضير — يُحدّث بطاقة المستفيد */
  dependentsCount: z.number().int().nonnegative(),
});

export async function GET(req: NextRequest) {
  const authz = await requirePermission("attendance:manage");
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
  const { page, pageSize, skip, take } = parsePageParams(req.nextUrl.searchParams);
  const where = { exhibitionId: exhibition.id };
  const [count, recent] = await Promise.all([
    prisma.attendance.count({ where }),
    prisma.attendance.findMany({
      where,
      include: { beneficiary: true },
      orderBy: { checkedInAt: "desc" },
      skip,
      take,
    }),
  ]);
  return NextResponse.json({
    count,
    recent,
    ...buildPageMeta(page, pageSize, count),
  });
}

export async function POST(req: NextRequest) {
  const authz = await requirePermission("attendance:manage");
  if ("error" in authz) return authz.error;

  const body = checkInSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
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
  let beneficiaryId = body.data.beneficiaryId;

  if (body.data.qrToken) {
    const invite = await prisma.exhibitionInvite.findUnique({
      where: { qrToken: body.data.qrToken },
      include: { beneficiary: true },
    });
    if (!invite) {
      return NextResponse.json({ error: "رمز QR غير صالح" }, { status: 404 });
    }
    if (invite.exhibitionId !== exhibition.id) {
      return NextResponse.json(
        { error: "الرمز لا يتبع المعرض النشط" },
        { status: 409 },
      );
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
    // تحديث التابعين ثم الحضور في معاملة واحدة — O(1)
    const [updatedBeneficiary, attendance] = await prisma.$transaction([
      prisma.beneficiary.update({
        where: { id: beneficiaryId },
        data: { dependentsCount: body.data.dependentsCount },
      }),
      prisma.attendance.create({
        data: {
          exhibitionId: exhibition.id,
          beneficiaryId,
          type: isException ? AttendanceType.EXCEPTION : AttendanceType.NORMAL,
          exceptionReason: isException ? body.data.exceptionReason!.trim() : null,
          checkedInById: authz.userId,
        },
      }),
    ]);

    await writeAuditLog({
      userId: authz.userId,
      action: isException ? "CHECKIN_EXCEPTION" : "CHECKIN",
      entityType: "Attendance",
      entityId: attendance.id,
      after: attendance,
      meta: {
        beneficiaryId,
        nationalId: beneficiary.nationalId,
        dependentsCount: body.data.dependentsCount,
        dependentsCountBefore: beneficiary.dependentsCount,
      },
    });

    return NextResponse.json({
      data: {
        attendance,
        beneficiary: {
          id: updatedBeneficiary.id,
          name: updatedBeneficiary.name,
          nationalId: updatedBeneficiary.nationalId,
          mobile: updatedBeneficiary.mobile,
          dependentsCount: updatedBeneficiary.dependentsCount,
        },
      },
    });
  } catch {
    return NextResponse.json({ error: "تعذر تسجيل الحضور (ربما مكرر)" }, { status: 409 });
  }
}

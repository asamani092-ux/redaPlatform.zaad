import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import {
  isValidNationalId,
  NATIONAL_ID_ERROR,
  normalizeNationalId,
} from "@/lib/national-id";
import { isValidSaudiMobile, MOBILE_ERROR, normalizeMobile } from "@/lib/mobile";
import { writeAuditLog } from "@/lib/audit";
import { Gender } from "@/generated/prisma/enums";

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  nationalId: z.string().optional(),
  mobile: z.string().min(9).optional(),
  gender: z.enum(["MALE", "FEMALE"]).optional().nullable(),
  neighborhood: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  associationId: z.string().optional().nullable(),
  associationOther: z.string().optional().nullable(),
  dependentsCount: z.number().int().nonnegative().optional(),
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const authz = await requirePermission("beneficiaries:manage");
  if ("error" in authz) return authz.error;
  const { id } = await ctx.params;

  const before = await prisma.beneficiary.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

  const body = updateSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  let nationalId = before.nationalId;
  if (body.data.nationalId !== undefined) {
    nationalId = normalizeNationalId(body.data.nationalId);
    if (!isValidNationalId(nationalId)) {
      return NextResponse.json({ error: NATIONAL_ID_ERROR }, { status: 400 });
    }
    if (nationalId !== before.nationalId) {
      const dup = await prisma.beneficiary.findUnique({ where: { nationalId } });
      if (dup && dup.id !== id) {
        return NextResponse.json({ error: "رقم الهوية مستخدم لمستفيد آخر" }, { status: 409 });
      }
    }
  }

  let mobile = before.mobile;
  if (body.data.mobile !== undefined) {
    mobile = normalizeMobile(body.data.mobile);
    if (!isValidSaudiMobile(mobile)) {
      return NextResponse.json({ error: MOBILE_ERROR }, { status: 400 });
    }
  }

  const updated = await prisma.beneficiary.update({
    where: { id },
    data: {
      name: body.data.name?.trim(),
      nationalId,
      mobile,
      gender:
        body.data.gender === undefined
          ? undefined
          : body.data.gender
            ? (body.data.gender as Gender)
            : null,
      neighborhood: body.data.neighborhood,
      city: body.data.city,
      birthDate:
        body.data.birthDate === undefined
          ? undefined
          : body.data.birthDate
            ? new Date(body.data.birthDate)
            : null,
      notes: body.data.notes,
      associationId: body.data.associationId,
      associationOther: body.data.associationOther,
      dependentsCount: body.data.dependentsCount,
    },
  });

  await writeAuditLog({
    userId: authz.userId,
    action: "UPDATE",
    entityType: "Beneficiary",
    entityId: id,
    before,
    after: updated,
  });

  return NextResponse.json({ data: updated });
}

/**
 * حذف مستفيد بتأكيد ثنائي من الواجهة.
 * يُمنع الحذف إذا وُجد حضور أو صرف — حفاظاً على التاريخ التشغيلي (مبدأ التراكم).
 * O(1) استعلامات بالفهارس.
 */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const authz = await requirePermission("beneficiaries:manage");
  if ("error" in authz) return authz.error;
  const { id } = await ctx.params;

  const before = await prisma.beneficiary.findUnique({
    where: { id },
    include: {
      _count: { select: { attendances: true, dispenseOrders: true, surveyResponses: true } },
    },
  });
  if (!before) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

  if (before._count.attendances > 0 || before._count.dispenseOrders > 0) {
    return NextResponse.json(
      { error: "لا يمكن الحذف — للمستفيد حضور أو صرف مسجل، والتاريخ التشغيلي محفوظ" },
      { status: 409 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.outboundMessage.updateMany({
      where: { beneficiaryId: id },
      data: { beneficiaryId: null },
    });
    await tx.beneficiary.delete({ where: { id } });
  });

  const { _count, ...snapshot } = before;
  void _count;
  await writeAuditLog({
    userId: authz.userId,
    action: "DELETE",
    entityType: "Beneficiary",
    entityId: id,
    before: snapshot,
  });

  return NextResponse.json({ ok: true });
}

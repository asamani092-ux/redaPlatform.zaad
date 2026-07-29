import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { isValidSaudiNationalId, normalizeNationalId } from "@/lib/national-id";
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
  if (body.data.nationalId) {
    nationalId = normalizeNationalId(body.data.nationalId);
    if (!isValidSaudiNationalId(nationalId)) {
      return NextResponse.json({ error: "رقم الهوية غير صالح" }, { status: 400 });
    }
    if (nationalId !== before.nationalId) {
      const dup = await prisma.beneficiary.findUnique({ where: { nationalId } });
      if (dup) {
        return NextResponse.json({ error: "رقم الهوية مستخدم لمستفيد آخر" }, { status: 409 });
      }
    }
  }

  const updated = await prisma.beneficiary.update({
    where: { id },
    data: {
      name: body.data.name?.trim(),
      nationalId,
      mobile: body.data.mobile?.trim(),
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

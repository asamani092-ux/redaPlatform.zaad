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
import { getActiveExhibition } from "@/lib/exhibition";
import { resolveStatus, STATUS_LABELS } from "@/lib/status";

const createSchema = z.object({
  name: z.string().min(2),
  nationalId: z.string(),
  mobile: z.string().min(9),
  gender: z.enum(["MALE", "FEMALE"]).optional().nullable(),
  neighborhood: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  associationId: z.string().optional().nullable(),
  associationOther: z.string().optional().nullable(),
  dependentsCount: z.number().int().nonnegative().optional(),
});

export async function GET(req: NextRequest) {
  const authz = await requirePermission("beneficiaries:view");
  if ("error" in authz) return authz.error;

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const exhibition = await getActiveExhibition();

  const beneficiaries = await prisma.beneficiary.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { nationalId: { contains: q } },
            { mobile: { contains: q } },
          ],
        }
      : undefined,
    include: {
      association: true,
      invites: exhibition
        ? { where: { exhibitionId: exhibition.id }, take: 1 }
        : false,
      attendances: exhibition
        ? { where: { exhibitionId: exhibition.id }, take: 1 }
        : false,
      dispenseOrders: exhibition
        ? { where: { exhibitionId: exhibition.id }, take: 1 }
        : false,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const rows = beneficiaries.map((b) => {
    const invite = Array.isArray(b.invites) ? b.invites[0] : undefined;
    const attendance = Array.isArray(b.attendances) ? b.attendances[0] : undefined;
    const dispense = Array.isArray(b.dispenseOrders) ? b.dispenseOrders[0] : undefined;
    const status = resolveStatus({
      invited: invite?.invited,
      attendanceType: attendance?.type ?? null,
      received: !!dispense,
    });
    return {
      ...b,
      status,
      statusLabel: STATUS_LABELS[status],
      qrToken: invite?.qrToken ?? null,
    };
  });

  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const authz = await requirePermission("beneficiaries:manage");
  if ("error" in authz) return authz.error;

  const body = createSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "بيانات غير صالحة", details: body.error.flatten() }, { status: 400 });
  }

  const nationalId = normalizeNationalId(body.data.nationalId);
  if (!isValidNationalId(nationalId)) {
    return NextResponse.json({ error: NATIONAL_ID_ERROR }, { status: 400 });
  }
  const mobile = normalizeMobile(body.data.mobile);
  if (!isValidSaudiMobile(mobile)) {
    return NextResponse.json({ error: MOBILE_ERROR }, { status: 400 });
  }

  const existing = await prisma.beneficiary.findUnique({ where: { nationalId } });
  if (existing) {
    return NextResponse.json({ error: "المستفيد مسجل مسبقاً بنفس رقم الهوية" }, { status: 409 });
  }

  const created = await prisma.beneficiary.create({
    data: {
      name: body.data.name.trim(),
      nationalId,
      mobile,
      gender: body.data.gender ? (body.data.gender as Gender) : null,
      neighborhood: body.data.neighborhood || null,
      city: body.data.city || null,
      birthDate: body.data.birthDate ? new Date(body.data.birthDate) : null,
      notes: body.data.notes || null,
      associationId: body.data.associationId || null,
      associationOther: body.data.associationOther || null,
      dependentsCount: body.data.dependentsCount ?? 0,
    },
  });

  await writeAuditLog({
    userId: authz.userId,
    action: "CREATE",
    entityType: "Beneficiary",
    entityId: created.id,
    after: created,
  });

  return NextResponse.json({ data: created }, { status: 201 });
}

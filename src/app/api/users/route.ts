import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";
import { Role } from "@/generated/prisma/enums";

const createSchema = z.object({
  name: z.string().min(2),
  mobile: z.string().min(9),
  password: z.string().min(4),
  role: z.enum([
    Role.ADMIN,
    Role.REGISTRATION,
    Role.RECEPTION,
    Role.DISTRIBUTION,
    Role.INVENTORY,
    Role.REPORTS,
  ]),
});

const updateSchema = z.object({
  id: z.string(),
  name: z.string().min(2).optional(),
  mobile: z.string().min(9).optional(),
  password: z.string().min(4).optional(),
  role: z
    .enum([
      Role.ADMIN,
      Role.REGISTRATION,
      Role.RECEPTION,
      Role.DISTRIBUTION,
      Role.INVENTORY,
      Role.REPORTS,
    ])
    .optional(),
  active: z.boolean().optional(),
});

export async function GET() {
  const authz = await requirePermission("users:manage");
  if ("error" in authz) return authz.error;
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      mobile: true,
      role: true,
      active: true,
      lastActiveAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ data: users });
}

export async function POST(req: NextRequest) {
  const authz = await requirePermission("users:manage");
  if ("error" in authz) return authz.error;
  const body = createSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const exists = await prisma.user.findUnique({ where: { mobile: body.data.mobile } });
  if (exists) {
    return NextResponse.json({ error: "الجوال مستخدم مسبقاً" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      name: body.data.name,
      mobile: body.data.mobile.trim(),
      role: body.data.role,
      passwordHash: await bcrypt.hash(body.data.password, 10),
    },
    select: { id: true, name: true, mobile: true, role: true, active: true },
  });

  await writeAuditLog({
    userId: authz.userId,
    action: "USER_CREATE",
    entityType: "User",
    entityId: user.id,
    after: user,
  });

  return NextResponse.json({ data: user }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const authz = await requirePermission("users:manage");
  if ("error" in authz) return authz.error;
  const body = updateSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const before = await prisma.user.findUnique({
    where: { id: body.data.id },
    select: { id: true, name: true, mobile: true, role: true, active: true },
  });
  if (!before) {
    return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
  }

  if (body.data.mobile && body.data.mobile !== before.mobile) {
    const dup = await prisma.user.findUnique({ where: { mobile: body.data.mobile } });
    if (dup) {
      return NextResponse.json({ error: "الجوال مستخدم مسبقاً" }, { status: 409 });
    }
  }

  const updated = await prisma.user.update({
    where: { id: body.data.id },
    data: {
      name: body.data.name,
      mobile: body.data.mobile?.trim(),
      role: body.data.role,
      active: body.data.active,
      passwordHash: body.data.password
        ? await bcrypt.hash(body.data.password, 10)
        : undefined,
    },
    select: { id: true, name: true, mobile: true, role: true, active: true },
  });

  await writeAuditLog({
    userId: authz.userId,
    action: "USER_UPDATE",
    entityType: "User",
    entityId: updated.id,
    before,
    after: updated,
  });

  return NextResponse.json({ data: updated });
}

/**
 * حذف مستخدم بتأكيد ثنائي. يُمنع حذف النفس وآخر مدير.
 * إن كان مرتبطاً بعمليات (حضور/صرف/سجل) يوقَّف بدل الحذف حفاظاً على التاريخ.
 */
export async function DELETE(req: NextRequest) {
  const authz = await requirePermission("users:manage");
  if ("error" in authz) return authz.error;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "حدد المستخدم" }, { status: 400 });
  if (id === authz.userId) {
    return NextResponse.json({ error: "لا يمكنك حذف حسابك الحالي" }, { status: 400 });
  }

  const before = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, mobile: true, role: true, active: true },
  });
  if (!before) return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });

  if (before.role === Role.ADMIN) {
    const admins = await prisma.user.count({ where: { role: Role.ADMIN, active: true } });
    if (admins <= 1) {
      return NextResponse.json({ error: "لا يمكن حذف آخر مدير نشط" }, { status: 400 });
    }
  }

  try {
    await prisma.user.delete({ where: { id } });
    await writeAuditLog({
      userId: authz.userId,
      action: "USER_DELETE",
      entityType: "User",
      entityId: id,
      before,
    });
    return NextResponse.json({ ok: true, deactivated: false });
  } catch {
    // مرتبط بعمليات (قيود مفاتيح خارجية) — إيقاف بدلاً من الحذف
    const updated = await prisma.user.update({
      where: { id },
      data: { active: false },
      select: { id: true, name: true, mobile: true, role: true, active: true },
    });
    await writeAuditLog({
      userId: authz.userId,
      action: "USER_DEACTIVATE",
      entityType: "User",
      entityId: id,
      before,
      after: updated,
    });
    return NextResponse.json({
      ok: true,
      deactivated: true,
      message: "المستخدم مرتبط بعمليات مسجلة — تم إيقافه بدلاً من الحذف حفاظاً على السجل",
    });
  }
}

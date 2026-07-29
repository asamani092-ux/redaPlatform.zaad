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

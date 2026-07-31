import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireSession } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  const authz = await requireSession();
  if ("error" in authz) return authz.error;
  const data = await prisma.associationOption.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ data });
}

const upsertSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function POST(req: NextRequest) {
  const authz = await requirePermission("settings:manage");
  if ("error" in authz) return authz.error;
  const body = upsertSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const name = body.data.name.trim();
  const created = await prisma.associationOption.create({
    data: {
      name,
      active: body.data.active ?? true,
      sortOrder: body.data.sortOrder ?? 0,
    },
  });

  await writeAuditLog({
    userId: authz.userId,
    action: "ASSOCIATION_UPSERT",
    entityType: "AssociationOption",
    entityId: created.id,
    after: created,
  });

  return NextResponse.json({ data: created }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const authz = await requirePermission("settings:manage");
  if ("error" in authz) return authz.error;
  const body = upsertSchema.extend({ id: z.string() }).safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const before = await prisma.associationOption.findUnique({ where: { id: body.data.id } });
  if (!before) {
    return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  }

  const updated = await prisma.associationOption.update({
    where: { id: body.data.id },
    data: {
      name: body.data.name.trim(),
      active: body.data.active,
      sortOrder: body.data.sortOrder,
    },
  });

  await writeAuditLog({
    userId: authz.userId,
    action: "ASSOCIATION_UPSERT",
    entityType: "AssociationOption",
    entityId: updated.id,
    before,
    after: updated,
  });

  return NextResponse.json({ data: updated });
}

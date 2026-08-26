import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";

/**
 * قائمة أدوار المتطوعين.
 * Time: O(r) حيث r عدد الأدوار. Space: O(r).
 */
export async function GET(req: NextRequest) {
  const authzVol = await requirePermission("volunteers:manage");
  const authzSettings =
    "error" in authzVol ? await requirePermission("settings:manage") : null;
  if ("error" in authzVol && authzSettings && "error" in authzSettings) {
    return authzVol.error;
  }

  const activeOnly = req.nextUrl.searchParams.get("active") === "1";
  const data = await prisma.volunteerRoleOption.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ data });
}

const putSchema = z.object({
  roles: z.array(
    z.object({
      id: z.string().optional(),
      name: z.string().min(1),
      active: z.boolean().optional(),
    }),
  ),
});

/**
 * حفظ قائمة الأدوار تراكمياً (upsert بالاسم/المعرّف).
 * Time: O(r). Space: O(1) لكل صف.
 */
export async function PUT(req: NextRequest) {
  const authz = await requirePermission("settings:manage");
  if ("error" in authz) return authz.error;

  const body = putSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  for (const [i, role] of body.data.roles.entries()) {
    const name = role.name.trim();
    if (!name) continue;
    if (role.id) {
      await prisma.volunteerRoleOption.update({
        where: { id: role.id },
        data: { name, active: role.active ?? true, sortOrder: i },
      });
    } else {
      await prisma.volunteerRoleOption.upsert({
        where: { name },
        update: { active: role.active ?? true, sortOrder: i },
        create: { name, active: role.active ?? true, sortOrder: i },
      });
    }
  }

  await writeAuditLog({
    userId: authz.userId,
    action: "UPDATE_VOLUNTEER_ROLES",
    entityType: "VolunteerRoleOption",
    meta: { count: body.data.roles.length },
  });

  const data = await prisma.volunteerRoleOption.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ data });
}

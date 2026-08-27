import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";
import { requireActiveExhibition } from "@/lib/exhibition";

const volunteerInclude = {
  tasks: {
    include: { role: true },
    orderBy: { role: { sortOrder: "asc" as const } },
  },
};

const createSchema = z.object({
  name: z.string().min(2),
  mobile: z.string().min(9),
  nationalId: z.string().min(10).max(14),
  taskIds: z.array(z.string().min(1)).min(1, "اختر مهمة واحدة على الأقل"),
});

const patchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2).optional(),
  mobile: z.string().min(9).optional(),
  nationalId: z.string().min(10).max(14).optional(),
  taskIds: z.array(z.string().min(1)).min(1).optional(),
});

/** تحقق مهام نشطة — Time O(t)، Space O(t) */
async function resolveActiveTaskIds(taskIds: string[]) {
  const unique = [...new Set(taskIds)];
  const roles = await prisma.volunteerRoleOption.findMany({
    where: { id: { in: unique }, active: true },
    select: { id: true },
  });
  if (roles.length !== unique.length) {
    return null;
  }
  return unique;
}

/**
 * قائمة متطوعي المعرض النشط.
 * Time: O(n). Space: O(n).
 */
export async function GET() {
  const authz = await requirePermission("volunteers:manage");
  if ("error" in authz) return authz.error;

  try {
    const exhibition = await requireActiveExhibition();
    const data = await prisma.volunteer.findMany({
      where: { exhibitionId: exhibition.id },
      include: volunteerInclude,
      orderBy: [{ createdAt: "desc" }],
      take: 1000,
    });
    return NextResponse.json({ data, exhibitionId: exhibition.id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "تعذر تحميل المتطوعين" },
      { status: 500 },
    );
  }
}

/**
 * إضافة متطوع + مهام متعددة.
 * Time: O(t).
 */
export async function POST(req: NextRequest) {
  const authz = await requirePermission("volunteers:manage");
  if ("error" in authz) return authz.error;

  const body = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json(
      { error: body.error.issues[0]?.message ?? "بيانات غير صالحة" },
      { status: 400 },
    );
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

  const taskIds = await resolveActiveTaskIds(body.data.taskIds);
  if (!taskIds) {
    return NextResponse.json({ error: "مهمة غير موجودة أو غير نشطة" }, { status: 400 });
  }

  const nationalId = body.data.nationalId.trim();
  const mobile = body.data.mobile.trim();
  const name = body.data.name.trim();

  try {
    const created = await prisma.$transaction(async (tx) => {
      const volunteer = await tx.volunteer.create({
        data: {
          exhibitionId: exhibition.id,
          name,
          mobile,
          nationalId,
          createdById: authz.userId,
        },
      });
      await tx.volunteerTask.createMany({
        data: taskIds.map((roleId) => ({ volunteerId: volunteer.id, roleId })),
      });
      return tx.volunteer.findUniqueOrThrow({
        where: { id: volunteer.id },
        include: volunteerInclude,
      });
    });

    await writeAuditLog({
      userId: authz.userId,
      action: "VOLUNTEER_CREATE",
      entityType: "Volunteer",
      entityId: created.id,
      after: created,
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (e) {
    const code =
      e && typeof e === "object" && "code" in e
        ? String((e as { code: unknown }).code)
        : "";
    const msg = e instanceof Error ? e.message : "";
    if (code === "P2003" && msg.includes("Volunteer_createdById_fkey")) {
      return NextResponse.json(
        { error: "انتهت الجلسة — سجّل الدخول مجدداً" },
        { status: 401 },
      );
    }
    if (msg.includes("Unique constraint") || msg.includes("Volunteer_exhibitionId_nationalId")) {
      return NextResponse.json(
        { error: "متطوع بنفس رقم الهوية مسجّل في هذا المعرض" },
        { status: 409 },
      );
    }
    console.error("volunteer POST failed:", e);
    return NextResponse.json({ error: "فشل الحفظ" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const authz = await requirePermission("volunteers:manage");
  if ("error" in authz) return authz.error;

  const body = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const before = await prisma.volunteer.findUnique({
    where: { id: body.data.id },
    include: volunteerInclude,
  });
  if (!before) {
    return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  }

  let taskIds: string[] | undefined;
  if (body.data.taskIds) {
    const resolved = await resolveActiveTaskIds(body.data.taskIds);
    if (!resolved) {
      return NextResponse.json({ error: "مهمة غير موجودة أو غير نشطة" }, { status: 400 });
    }
    taskIds = resolved;
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.volunteer.update({
        where: { id: body.data.id },
        data: {
          name: body.data.name?.trim(),
          mobile: body.data.mobile?.trim(),
          nationalId: body.data.nationalId?.trim(),
        },
      });
      if (taskIds) {
        await tx.volunteerTask.deleteMany({ where: { volunteerId: body.data.id } });
        await tx.volunteerTask.createMany({
          data: taskIds.map((roleId) => ({ volunteerId: body.data.id, roleId })),
        });
      }
      return tx.volunteer.findUniqueOrThrow({
        where: { id: body.data.id },
        include: volunteerInclude,
      });
    });

    await writeAuditLog({
      userId: authz.userId,
      action: "VOLUNTEER_UPDATE",
      entityType: "Volunteer",
      entityId: updated.id,
      before,
      after: updated,
    });

    return NextResponse.json({ data: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "متطوع بنفس رقم الهوية مسجّل في هذا المعرض" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "فشل التحديث" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authz = await requirePermission("volunteers:manage");
  if ("error" in authz) return authz.error;

  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "معرّف مطلوب" }, { status: 400 });
  }

  const before = await prisma.volunteer.findUnique({
    where: { id },
    include: volunteerInclude,
  });
  if (!before) {
    return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  }

  await prisma.volunteer.delete({ where: { id } });
  await writeAuditLog({
    userId: authz.userId,
    action: "VOLUNTEER_DELETE",
    entityType: "Volunteer",
    entityId: id,
    before,
  });
  return NextResponse.json({ ok: true });
}

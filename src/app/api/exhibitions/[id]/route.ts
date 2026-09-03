import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requirePermission } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";
import { normalizeExhibitionName } from "@/lib/exhibition";

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  location: z.string().optional().nullable(),
  startsAt: z.string().optional().nullable(),
  endsAt: z.string().optional().nullable(),
});

/** تحويل مدخل التاريخ (YYYY-MM-DD أو ISO) — undefined = لم يُرسل، null = مسح القيمة */
function parseDateField(
  value: string | null | undefined,
): { ok: true; value: Date | null | undefined } | { ok: false } {
  if (value === undefined) return { ok: true, value: undefined };
  const raw = value?.trim() ?? "";
  if (!raw) return { ok: true, value: null };
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return { ok: false };
  return { ok: true, value: parsed };
}

/**
 * تعديل بيانات المعرض (الاسم/الموقع/الفترة) — إدارة المعارض فقط.
 * Time: O(1).
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const authz = await requirePermission("exhibitions:manage");
  if ("error" in authz) return authz.error;

  const { id } = await ctx.params;
  const body = patchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const before = await prisma.exhibition.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "المعرض غير موجود" }, { status: 404 });
  }

  const starts = parseDateField(body.data.startsAt);
  const ends = parseDateField(body.data.endsAt);
  if (!starts.ok || !ends.ok) {
    return NextResponse.json({ error: "تاريخ غير صالح" }, { status: 400 });
  }

  const nextStartsAt = starts.value === undefined ? before.startsAt : starts.value;
  const nextEndsAt = ends.value === undefined ? before.endsAt : ends.value;
  if (
    nextStartsAt &&
    nextEndsAt &&
    nextEndsAt.getTime() < nextStartsAt.getTime()
  ) {
    return NextResponse.json(
      { error: "تاريخ النهاية يجب ألا يسبق تاريخ البداية" },
      { status: 400 },
    );
  }

  const data: {
    name?: string;
    location?: string | null;
    startsAt?: Date | null;
    endsAt?: Date | null;
  } = {};

  if (body.data.name !== undefined) {
    const name = normalizeExhibitionName(body.data.name);
    if (name.length < 2) {
      return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    }
    if (name !== before.name) {
      const dup = await prisma.exhibition.findUnique({ where: { name } });
      if (dup) {
        return NextResponse.json(
          { error: "يوجد معرض بنفس الاسم" },
          { status: 409 },
        );
      }
      data.name = name;
    }
  }
  if (body.data.location !== undefined) {
    data.location = body.data.location?.trim() || null;
  }
  if (starts.value !== undefined) data.startsAt = starts.value;
  if (ends.value !== undefined) data.endsAt = ends.value;

  if (!Object.keys(data).length) {
    return NextResponse.json({ data: before });
  }

  const updated = await prisma.exhibition.update({
    where: { id },
    data,
    include: { settings: true },
  });

  await writeAuditLog({
    userId: authz.userId,
    action: "EXHIBITION_UPDATE",
    entityType: "Exhibition",
    entityId: id,
    before: {
      name: before.name,
      location: before.location,
      startsAt: before.startsAt,
      endsAt: before.endsAt,
    },
    after: {
      name: updated.name,
      location: updated.location,
      startsAt: updated.startsAt,
      endsAt: updated.endsAt,
    },
  });

  return NextResponse.json({ data: updated });
}

/**
 * حذف معرض — مدير النظام فقط. يُمنع حذف المعرض النشط تشغيلياً.
 * Time: O(1) + تكلفة CASCADE.
 */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const authz = await requireAdmin();
  if ("error" in authz) return authz.error;

  const { id } = await ctx.params;
  const before = await prisma.exhibition.findUnique({
    where: { id },
    include: { settings: true },
  });
  if (!before) {
    return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  }
  if (before.active) {
    return NextResponse.json(
      { error: "لا يمكن حذف المعرض النشط — فعّل معرضاً آخر أولاً" },
      { status: 409 },
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.outboundMessage.updateMany({
        where: { exhibitionId: id },
        data: { exhibitionId: null },
      });
      await tx.exhibition.delete({ where: { id } });
    });
  } catch (e) {
    console.error("exhibition DELETE failed:", e);
    return NextResponse.json({ error: "فشل حذف المعرض" }, { status: 500 });
  }

  await writeAuditLog({
    userId: authz.userId,
    action: "EXHIBITION_DELETE",
    entityType: "Exhibition",
    entityId: id,
    before,
  });

  return NextResponse.json({ ok: true });
}

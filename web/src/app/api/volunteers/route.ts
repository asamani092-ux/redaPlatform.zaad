import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";
import { requireActiveExhibition } from "@/lib/exhibition";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { OutboundMessageType } from "@/generated/prisma/enums";

const createSchema = z.object({
  name: z.string().min(2),
  mobile: z.string().min(9),
  nationalId: z.string().min(10).max(14),
  roleId: z.string().min(1),
  sendThanks: z.boolean().optional(),
});

const patchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2).optional(),
  mobile: z.string().min(9).optional(),
  nationalId: z.string().min(10).max(14).optional(),
  roleId: z.string().min(1).optional(),
  sendThanks: z.boolean().optional(),
});

/**
 * قائمة متطوعي المعرض النشط.
 * Time: O(n). Space: O(n).
 */
export async function GET() {
  const authz = await requirePermission("volunteers:manage");
  if ("error" in authz) return authz.error;

  const exhibition = await requireActiveExhibition();
  const data = await prisma.volunteer.findMany({
    where: { exhibitionId: exhibition.id },
    include: { role: true },
    orderBy: [{ createdAt: "desc" }],
    take: 1000,
  });
  return NextResponse.json({ data, exhibitionId: exhibition.id });
}

/**
 * إضافة متطوع + إرسال شكر اختياري.
 * Time: O(1) + تكلفة واتساب.
 */
export async function POST(req: NextRequest) {
  const authz = await requirePermission("volunteers:manage");
  if ("error" in authz) return authz.error;

  const body = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const exhibition = await requireActiveExhibition();
  const role = await prisma.volunteerRoleOption.findFirst({
    where: { id: body.data.roleId, active: true },
  });
  if (!role) {
    return NextResponse.json({ error: "الدور غير موجود أو غير نشط" }, { status: 400 });
  }

  const nationalId = body.data.nationalId.trim();
  const mobile = body.data.mobile.trim();
  const name = body.data.name.trim();

  try {
    const created = await prisma.volunteer.create({
      data: {
        exhibitionId: exhibition.id,
        name,
        mobile,
        nationalId,
        roleId: role.id,
        createdById: authz.userId,
      },
      include: { role: true },
    });

    await writeAuditLog({
      userId: authz.userId,
      action: "VOLUNTEER_CREATE",
      entityType: "Volunteer",
      entityId: created.id,
      after: created,
    });

    let thanksStatus: string | null = null;
    if (body.data.sendThanks) {
      thanksStatus = await sendVolunteerThanks({
        volunteerId: created.id,
        exhibitionId: exhibition.id,
        exhibitionName: exhibition.name,
        name: created.name,
        mobile: created.mobile,
        userId: authz.userId,
      });
    }

    const fresh = await prisma.volunteer.findUnique({
      where: { id: created.id },
      include: { role: true },
    });
    return NextResponse.json({ data: fresh, thanksStatus }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique constraint") || msg.includes("Volunteer_exhibitionId_nationalId")) {
      return NextResponse.json(
        { error: "متطوع بنفس رقم الهوية مسجّل في هذا المعرض" },
        { status: 409 },
      );
    }
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

  const before = await prisma.volunteer.findUnique({ where: { id: body.data.id } });
  if (!before) {
    return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  }

  if (body.data.roleId) {
    const role = await prisma.volunteerRoleOption.findFirst({
      where: { id: body.data.roleId, active: true },
    });
    if (!role) {
      return NextResponse.json({ error: "الدور غير موجود أو غير نشط" }, { status: 400 });
    }
  }

  try {
    const updated = await prisma.volunteer.update({
      where: { id: body.data.id },
      data: {
        name: body.data.name?.trim(),
        mobile: body.data.mobile?.trim(),
        nationalId: body.data.nationalId?.trim(),
        roleId: body.data.roleId,
      },
      include: { role: true },
    });

    await writeAuditLog({
      userId: authz.userId,
      action: "VOLUNTEER_UPDATE",
      entityType: "Volunteer",
      entityId: updated.id,
      before,
      after: updated,
    });

    let thanksStatus: string | null = null;
    if (body.data.sendThanks) {
      const exhibition = await prisma.exhibition.findUnique({
        where: { id: updated.exhibitionId },
      });
      thanksStatus = await sendVolunteerThanks({
        volunteerId: updated.id,
        exhibitionId: updated.exhibitionId,
        exhibitionName: exhibition?.name ?? "",
        name: updated.name,
        mobile: updated.mobile,
        userId: authz.userId,
      });
    }

    const fresh = await prisma.volunteer.findUnique({
      where: { id: updated.id },
      include: { role: true },
    });
    return NextResponse.json({ data: fresh, thanksStatus });
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

  const before = await prisma.volunteer.findUnique({ where: { id } });
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

async function sendVolunteerThanks(input: {
  volunteerId: string;
  exhibitionId: string;
  exhibitionName: string;
  name: string;
  mobile: string;
  userId: string;
}): Promise<string> {
  const settings = await prisma.exhibitionSettings.findUnique({
    where: { exhibitionId: input.exhibitionId },
  });
  const tpl =
    settings?.whatsappThanksTpl ??
    "شكراً لتطوعك في {{exhibition}}، {{name}}.";
  const bodyText = tpl
    .replaceAll("{{name}}", input.name)
    .replaceAll("{{exhibition}}", input.exhibitionName);

  const msg = await sendWhatsAppMessage({
    exhibitionId: input.exhibitionId,
    mobile: input.mobile,
    body: bodyText,
    type: OutboundMessageType.THANK_YOU,
    createdById: input.userId,
    templateParams: [input.name, input.exhibitionName],
  });

  await prisma.volunteer.update({
    where: { id: input.volunteerId },
    data: { thanksSentAt: new Date() },
  });

  return msg.status;
}

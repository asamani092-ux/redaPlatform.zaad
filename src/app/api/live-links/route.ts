import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import type { Role } from "@/generated/prisma/enums";
import { appOrigin } from "@/lib/app-url";
import { writeAuditLog } from "@/lib/audit";

const createSchema = z.object({
  exhibitionId: z.string().min(1),
  label: z.string().max(120).optional().nullable(),
});

function canManageLinks(role: Role) {
  return role === "ADMIN" || role === "REPORTS";
}

export async function GET(req: NextRequest) {
  const authz = await requirePermission("reports:view");
  if ("error" in authz) return authz.error;
  if (!canManageLinks(authz.role)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const exhibitionId = req.nextUrl.searchParams.get("exhibitionId");
  if (!exhibitionId) {
    return NextResponse.json({ error: "exhibitionId مطلوب" }, { status: 400 });
  }

  const links = await prisma.liveDisplayLink.findMany({
    where: { exhibitionId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const origin = appOrigin(req);
  return NextResponse.json({
    data: links.map((l) => ({
      id: l.id,
      token: l.token,
      label: l.label,
      createdAt: l.createdAt.toISOString(),
      url: `${origin}/live/${l.token}`,
    })),
  });
}

export async function POST(req: NextRequest) {
  const authz = await requirePermission("reports:view");
  if ("error" in authz) return authz.error;
  if (!canManageLinks(authz.role)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const body = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const exhibition = await prisma.exhibition.findUnique({
    where: { id: body.data.exhibitionId },
    select: { id: true },
  });
  if (!exhibition) {
    return NextResponse.json({ error: "المعرض غير موجود" }, { status: 404 });
  }

  const token = randomBytes(24).toString("base64url");
  const link = await prisma.liveDisplayLink.create({
    data: {
      token,
      exhibitionId: body.data.exhibitionId,
      label: body.data.label?.trim() || null,
      createdById: authz.userId,
    },
  });

  await writeAuditLog({
    userId: authz.userId,
    action: "LIVE_LINK_CREATE",
    entityType: "LiveDisplayLink",
    entityId: link.id,
    meta: { exhibitionId: link.exhibitionId, label: link.label },
    status: "SUCCESS",
  });

  const origin = appOrigin(req);
  return NextResponse.json(
    {
      data: {
        id: link.id,
        token: link.token,
        label: link.label,
        createdAt: link.createdAt.toISOString(),
        url: `${origin}/live/${link.token}`,
      },
    },
    { status: 201 },
  );
}

export async function DELETE(req: NextRequest) {
  const authz = await requirePermission("reports:view");
  if ("error" in authz) return authz.error;
  if (!canManageLinks(authz.role)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id مطلوب" }, { status: 400 });
  }

  const existing = await prisma.liveDisplayLink.findUnique({ where: { id } });
  if (!existing || existing.revokedAt) {
    return NextResponse.json({ error: "الرابط غير موجود" }, { status: 404 });
  }

  await prisma.liveDisplayLink.update({
    where: { id },
    data: { revokedAt: new Date() },
  });

  await writeAuditLog({
    userId: authz.userId,
    action: "LIVE_LINK_DELETE",
    entityType: "LiveDisplayLink",
    entityId: id,
    meta: { exhibitionId: existing.exhibitionId },
    status: "SUCCESS",
  });

  return NextResponse.json({ ok: true });
}

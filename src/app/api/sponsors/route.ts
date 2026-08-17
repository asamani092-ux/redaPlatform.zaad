import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireSession } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";
import {
  deleteUploadIfExists,
  saveSponsorLogo,
  sponsorLogoPublicUrl,
} from "@/lib/uploads";

function mapSponsor(s: {
  id: string;
  name: string;
  logoPath: string;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...s,
    logoUrl: sponsorLogoPublicUrl(s.logoPath),
  };
}

/** قائمة الداعمين — Time: O(n). */
export async function GET(req: NextRequest) {
  const authz = await requireSession();
  if ("error" in authz) return authz.error;
  const activeOnly = req.nextUrl.searchParams.get("active") === "1";
  const data = await prisma.sponsor.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ data: data.map(mapSponsor) });
}

export async function POST(req: NextRequest) {
  const authz = await requirePermission("settings:manage");
  if ("error" in authz) return authz.error;

  const form = await req.formData();
  const name = String(form.get("name") ?? "").trim();
  const sortOrder = Number(form.get("sortOrder") ?? 0);
  const file = form.get("logo");
  if (!name) {
    return NextResponse.json({ error: "اسم الداعم مطلوب" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "شعار الداعم مطلوب" }, { status: 400 });
  }

  let logoPath: string;
  try {
    ({ logoPath } = await saveSponsorLogo(file));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "فشل حفظ الشعار" },
      { status: 400 },
    );
  }

  const created = await prisma.sponsor.create({
    data: {
      name,
      logoPath,
      sortOrder: Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : 0,
      active: true,
    },
  });

  await writeAuditLog({
    userId: authz.userId,
    action: "SPONSOR_CREATE",
    entityType: "Sponsor",
    entityId: created.id,
    after: created,
  });

  return NextResponse.json({ data: mapSponsor(created) }, { status: 201 });
}

const patchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(req: NextRequest) {
  const authz = await requirePermission("settings:manage");
  if ("error" in authz) return authz.error;
  const body = patchSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const before = await prisma.sponsor.findUnique({ where: { id: body.data.id } });
  if (!before) {
    return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  }

  const updated = await prisma.sponsor.update({
    where: { id: body.data.id },
    data: {
      name: body.data.name?.trim(),
      active: body.data.active,
      sortOrder: body.data.sortOrder,
    },
  });

  await writeAuditLog({
    userId: authz.userId,
    action: "SPONSOR_UPDATE",
    entityType: "Sponsor",
    entityId: updated.id,
    before,
    after: updated,
  });

  return NextResponse.json({ data: mapSponsor(updated) });
}

export async function DELETE(req: NextRequest) {
  const authz = await requirePermission("settings:manage");
  if ("error" in authz) return authz.error;
  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "معرّف مطلوب" }, { status: 400 });
  }
  const before = await prisma.sponsor.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  }
  await prisma.sponsor.delete({ where: { id } });
  await deleteUploadIfExists(before.logoPath);
  await writeAuditLog({
    userId: authz.userId,
    action: "SPONSOR_DELETE",
    entityType: "Sponsor",
    entityId: id,
    before,
  });
  return NextResponse.json({ ok: true });
}

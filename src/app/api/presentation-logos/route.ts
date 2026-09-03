import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";

/** O(1) مساحة/زمن لكل ملف — حد أقصى عملي 2MB */
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Map<string, string>([
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["image/jpg", ".jpg"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
  ["image/svg+xml", ".svg"],
]);

function uploadsRoot(): string {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), "data", "uploads");
}

export async function POST(req: NextRequest) {
  const authz = await requirePermission("reports:view");
  if ("error" in authz) return authz.error;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "تعذر قراءة الملف" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "الملف مطلوب" }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "حجم الملف غير مقبول (حد 2MB)" }, { status: 400 });
  }
  const ext = ALLOWED.get(file.type);
  if (!ext) {
    return NextResponse.json({ error: "نوع الصورة غير مدعوم" }, { status: 400 });
  }

  const dir = path.join(uploadsRoot(), "presentation-logos");
  await mkdir(dir, { recursive: true });
  const name = `${randomUUID()}${ext}`;
  const abs = path.join(dir, name);
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(abs, buf);

  const url = `/api/presentation-logos/${name}`;
  await writeAuditLog({
    userId: authz.userId,
    action: "PRESENTATION_LOGO_UPLOAD",
    entityType: "PresentationLogo",
    entityId: name,
    after: { url, size: file.size, type: file.type },
  });

  return NextResponse.json({ url });
}

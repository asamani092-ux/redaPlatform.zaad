import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { resolveUploadAbs } from "@/lib/uploads";

const CONTENT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

/**
 * خدمة ملفات الرفع العامة (شعارات الداعمين) — Time: O(size) للقراءة.
 * المسار: /api/uploads/sponsors/<file>
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const parts = (await ctx.params).path ?? [];
  if (!parts.length) {
    return NextResponse.json({ error: "مسار غير صالح" }, { status: 400 });
  }
  const logoPath = parts.map(decodeURIComponent).join("/");
  const abs = resolveUploadAbs(logoPath);
  if (!abs) {
    return NextResponse.json({ error: "مسار مرفوض" }, { status: 400 });
  }
  try {
    const buf = await readFile(abs);
    const ext = path.extname(abs).toLowerCase();
    return new NextResponse(buf, {
      headers: {
        "Content-Type": CONTENT[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "الملف غير موجود" }, { status: 404 });
  }
}

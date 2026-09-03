import { readFile, stat } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/session";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

function uploadsRoot(): string {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), "data", "uploads");
}

function safeName(name: string): string | null {
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) return null;
  if (name.includes("..")) return null;
  return name;
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ name: string }> },
) {
  const authz = await requirePermission("reports:view");
  if ("error" in authz) return authz.error;

  const { name: raw } = await ctx.params;
  const name = safeName(raw);
  if (!name) {
    return NextResponse.json({ error: "اسم غير صالح" }, { status: 400 });
  }

  const abs = path.join(uploadsRoot(), "presentation-logos", name);
  try {
    await stat(abs);
  } catch {
    return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  }

  const buf = await readFile(abs);
  const ext = path.extname(name).toLowerCase();
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
    },
  });
}

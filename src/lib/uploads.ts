import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

/** جذر الرفع — محلياً .data/uploads، وفي الإنتاج /data/uploads */
export function uploadsRoot(): string {
  return process.env.UPLOADS_DIR?.trim() || path.join(process.cwd(), ".data", "uploads");
}

export function sponsorsDir(): string {
  return path.join(uploadsRoot(), "sponsors");
}

const ALLOWED = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

const MAX_BYTES = 1024 * 1024; // 1MB

/**
 * يحفظ شعار داعم تحت sponsors/ — Time: O(size) للكتابة؛ Space: O(size).
 */
export async function saveSponsorLogo(file: File): Promise<{ logoPath: string }> {
  const ext = ALLOWED.get(file.type);
  if (!ext) {
    throw new Error("صيغة الشعار غير مدعومة — استخدم PNG أو JPEG أو WebP");
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    throw new Error("حجم الشعار يجب ألا يتجاوز 1 ميجابايت");
  }
  await mkdir(sponsorsDir(), { recursive: true });
  const name = `${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;
  const abs = path.join(sponsorsDir(), name);
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(abs, buf);
  return { logoPath: `sponsors/${name}` };
}

export function resolveUploadAbs(logoPath: string): string | null {
  const cleaned = logoPath.replace(/^\/+/, "").replace(/\.\./g, "");
  if (!cleaned.startsWith("sponsors/")) return null;
  const abs = path.join(uploadsRoot(), cleaned);
  const root = path.resolve(uploadsRoot());
  if (!path.resolve(abs).startsWith(root + path.sep) && path.resolve(abs) !== root) {
    return null;
  }
  return abs;
}

export async function deleteUploadIfExists(logoPath: string): Promise<void> {
  const abs = resolveUploadAbs(logoPath);
  if (!abs) return;
  try {
    await unlink(abs);
  } catch {
    /* ignore missing */
  }
}

export function sponsorLogoPublicUrl(logoPath: string): string {
  const cleaned = logoPath.replace(/^\/+/, "");
  return `/api/uploads/${cleaned.split("/").map(encodeURIComponent).join("/")}`;
}

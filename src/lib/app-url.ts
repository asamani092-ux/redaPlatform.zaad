import type { NextRequest } from "next/server";

function isLocalHost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

/** أصل التطبيق لروابط عامة (QR / واتساب) — O(1) */
export function appOrigin(req?: NextRequest): string {
  const env =
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.APP_URL?.trim();
  // في النشر: لا تفضّل عنواناً محلياً على مضيف الطلب الحقيقي
  if (env && !(process.env.NODE_ENV === "production" && isLocalHost(env))) {
    return env.replace(/\/$/, "");
  }
  if (req) {
    const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const host = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    if (proto && host) return `${proto}://${host}`.replace(/\/$/, "");
    return req.nextUrl.origin;
  }
  return "http://localhost:3100";
}

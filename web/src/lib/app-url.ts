import type { NextRequest } from "next/server";

/** أصل التطبيق لروابط عامة (QR / واتساب) — O(1) */
export function appOrigin(req?: NextRequest): string {
  const env = process.env.NEXTAUTH_URL?.trim() || process.env.APP_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  if (req) return req.nextUrl.origin;
  return "http://localhost:3100";
}

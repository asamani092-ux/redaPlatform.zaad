import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildLiveMetrics } from "@/lib/live-metrics";

/** مؤشرات عامة للعرض الحي — بدون جلسة وبدون PII */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  if (!token || token.length < 16) {
    return NextResponse.json({ error: "رابط غير صالح" }, { status: 404 });
  }

  const link = await prisma.liveDisplayLink.findUnique({
    where: { token },
    select: { exhibitionId: true, revokedAt: true },
  });
  if (!link || link.revokedAt) {
    return NextResponse.json({ error: "الرابط غير موجود أو موقوف" }, { status: 404 });
  }

  const metrics = await buildLiveMetrics(link.exhibitionId);
  if (!metrics) {
    return NextResponse.json({ error: "المعرض غير موجود" }, { status: 404 });
  }

  return NextResponse.json(metrics, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

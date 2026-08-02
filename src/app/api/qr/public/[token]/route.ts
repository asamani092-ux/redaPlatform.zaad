import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";

/**
 * صورة QR عامة لرمز دعوة صالح — بدون جلسة (للواتساب / الروابط).
 * Time: O(1) استعلام + توليد الصورة.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  if (!token || token.length < 8) {
    return NextResponse.json({ error: "غير صالح" }, { status: 400 });
  }

  const invite = await prisma.exhibitionInvite.findUnique({
    where: { qrToken: token },
    select: { id: true, invited: true },
  });
  if (!invite || !invite.invited) {
    return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  }

  const png = await QRCode.toBuffer(token, { type: "png", width: 320, margin: 1 });
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}

import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const authz = await requireSession();
  if ("error" in authz) return authz.error;
  const { token } = await ctx.params;

  const invite = await prisma.exhibitionInvite.findUnique({
    where: { qrToken: token },
    include: { beneficiary: true, exhibition: true },
  });
  if (!invite) {
    return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  }

  const png = await QRCode.toBuffer(token, { type: "png", width: 280, margin: 1 });
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=3600",
    },
  });
}

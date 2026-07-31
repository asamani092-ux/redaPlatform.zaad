import "dotenv/config";
import fs from "fs";
import path from "path";
import QRCode from "qrcode";
import { buildInviteQrCardsPdf } from "../src/lib/qr-cards-pdf";
import { assert, makePrisma, seedFixture } from "./helpers";

async function main() {
  const prisma = makePrisma();
  const stamp = Date.now();
  const { exhibition } = await seedFixture(prisma, stamp);
  const b = await prisma.beneficiary.create({
    data: {
      name: "مدعو بطاقة",
      nationalId: `7${String(stamp).slice(-9)}`,
      mobile: "0507000001",
    },
  });
  const invite = await prisma.exhibitionInvite.create({
    data: {
      exhibitionId: exhibition.id,
      beneficiaryId: b.id,
      invited: true,
    },
  });

  console.log("=== QR cards PDF ===");
  const pdf = await buildInviteQrCardsPdf([
    {
      exhibitionName: exhibition.name,
      name: b.name,
      nationalId: b.nationalId,
      qrToken: invite.qrToken,
    },
  ]);
  assert(pdf.length > 500, "pdf non-empty");
  assert(pdf.subarray(0, 4).toString() === "%PDF", "pdf magic");

  const out = path.join(process.cwd(), "backups", `qr-test-${stamp}.pdf`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, pdf);
  console.log("wrote", out, "bytes", pdf.length);

  // QR payload round-trip: token encodes to image and decodes conceptually to same token
  const png = await QRCode.toBuffer(invite.qrToken, { type: "png", width: 120 });
  assert(png.length > 100, "qr png generated");
  // Resolve token via DB (same as scanner would)
  const found = await prisma.exhibitionInvite.findUnique({
    where: { qrToken: invite.qrToken },
    include: { beneficiary: true },
  });
  assert(found?.beneficiaryId === b.id, "QR token resolves to beneficiary");
  assert(found?.beneficiary.name === "مدعو بطاقة", "Arabic name preserved in DB for card");

  console.log("QR CARDS TESTS PASSED");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

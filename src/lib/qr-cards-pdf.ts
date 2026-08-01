import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";

export type QrCardInput = {
  exhibitionName: string;
  name: string;
  nationalId: string;
  qrToken: string;
};

function fontPath(): string {
  return path.join(process.cwd(), "assets/fonts/NotoNaskhArabic-Regular.ttf");
}

/** بطاقات QR جاهزة للطباعة — عربي RTL، بطاقة لكل مدعو */
export async function buildInviteQrCardsPdf(
  cards: QrCardInput[],
): Promise<Buffer> {
  const font = fontPath();
  if (!fs.existsSync(font)) {
    throw new Error("خط عربي غير موجود: assets/fonts/NotoNaskhArabic-Regular.ttf");
  }

  // تمرير الخط في الإنشاء يمنع pdfkit من تحميل Helvetica الافتراضي (غير مضمّن في حزمة Next)
  const doc = new PDFDocument({
    size: "A4",
    margin: 36,
    autoFirstPage: false,
    font,
  });

  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(Buffer.from(c)));

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.registerFont("arabic", font);

  const perPage = 4;
  for (let i = 0; i < cards.length; i++) {
    if (i % perPage === 0) doc.addPage();
    const card = cards[i]!;
    const slot = i % perPage;
    const y = 48 + slot * 180;

    doc.font("arabic").fontSize(14).text(card.exhibitionName, 48, y, {
      width: 320,
      align: "right",
    });
    doc.fontSize(12).text(card.name, 48, y + 28, { width: 320, align: "right" });
    // لا نطبع رقم الهوية كاملاً على البطاقة المطبوعة للخصوصية — آخر 4 فقط
    const maskedId =
      card.nationalId.length > 4
        ? `****${card.nationalId.slice(-4)}`
        : card.nationalId;
    doc.fontSize(10).text(`هوية: ${maskedId}`, 48, y + 52, {
      width: 320,
      align: "right",
    });

    const png = await QRCode.toBuffer(card.qrToken, {
      type: "png",
      width: 120,
      margin: 1,
      errorCorrectionLevel: "M",
    });
    doc.image(png, 420, y, { width: 120, height: 120 });
    doc.rect(36, y - 8, 520, 160).stroke("#999");
  }

  if (!cards.length) {
    doc.addPage();
    doc.font("arabic").fontSize(14).text("لا يوجد مدعوون لهذا المعرض", {
      align: "right",
    });
  }

  doc.end();
  return done;
}

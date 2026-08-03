import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { requireActiveExhibition } from "@/lib/exhibition";
import { buildPrintDocument, escapeHtml } from "@/lib/print-html";
import { writeAuditLog } from "@/lib/audit";

/**
 * طباعة قائمة المدعوين فقط (مع QR) بهوية المنصة — O(n) بعدد المدعوين.
 */
export async function GET() {
  const authz = await requirePermission("invites:manage");
  if ("error" in authz) return authz.error;

  let exhibition;
  try {
    exhibition = await requireActiveExhibition();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "لا يوجد معرض نشط" },
      { status: 400 },
    );
  }

  const invites = await prisma.exhibitionInvite.findMany({
    where: { exhibitionId: exhibition.id, invited: true },
    include: { beneficiary: { include: { association: true } } },
    orderBy: [{ invitedAt: "asc" }, { beneficiary: { name: "asc" } }],
  });

  const rows = await Promise.all(
    invites.map(async (inv, idx) => {
      const qrDataUrl = await QRCode.toDataURL(inv.qrToken, {
        type: "image/png",
        width: 120,
        margin: 1,
        errorCorrectionLevel: "M",
      });
      const b = inv.beneficiary;
      const assoc = b.association?.name || b.associationOther || "—";
      return `<tr>
        <td>${idx + 1}</td>
        <td>${escapeHtml(b.name)}</td>
        <td class="ltr">${escapeHtml(b.nationalId)}</td>
        <td class="ltr">${escapeHtml(b.mobile)}</td>
        <td>${escapeHtml(assoc)}</td>
        <td class="qr-cell"><img src="${qrDataUrl}" alt="QR" width="72" height="72" /></td>
      </tr>`;
    }),
  );

  const html = buildPrintDocument({
    title: `قائمة مدعوي: ${exhibition.name}`,
    subtitle: exhibition.location
      ? `الموقع: ${exhibition.location} — المدعوون فقط (${invites.length})`
      : `المدعوون فقط (${invites.length})`,
    tiles: [{ label: "عدد المدعوين", value: invites.length }],
    sectionsHtml: `
      <style>
        td.qr-cell { text-align: center; width: 90px; }
        td.qr-cell img { display: inline-block; width: 72px; height: 72px; }
        @media print {
          tr { page-break-inside: avoid; }
        }
      </style>
      <h2>المدعوون للمعرض النشط</h2>
      ${
        invites.length
          ? `<table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>الاسم</th>
                  <th>الهوية</th>
                  <th>الجوال</th>
                  <th>الجمعية</th>
                  <th>رمز QR</th>
                </tr>
              </thead>
              <tbody>${rows.join("")}</tbody>
            </table>`
          : `<p>لا يوجد مدعوون بعد لهذا المعرض.</p>`
      }
      <p class="no-print" style="margin-top:12px">
        <button onclick="window.print()" style="padding:8px 16px;cursor:pointer">طباعة</button>
      </p>`,
  });

  await writeAuditLog({
    userId: authz.userId,
    action: "QR_CARDS_EXPORT",
    entityType: "ExhibitionInvite",
    entityId: exhibition.id,
    meta: { count: invites.length, format: "print-html" },
  });

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

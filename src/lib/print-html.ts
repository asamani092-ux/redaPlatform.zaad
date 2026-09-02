/**
 * قالب طباعة HTML موحّد بهوية المنصة (شعار + ألوان) للتقارير وسجل العمليات.
 * O(n) بعدد الصفوف.
 */
export function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export type PrintTile = { label: string; value: string | number };

export function buildPrintDocument(opts: {
  title: string;
  subtitle?: string;
  tiles?: PrintTile[];
  sectionsHtml: string;
}): string {
  const tilesHtml = (opts.tiles ?? [])
    .map(
      (t) => `
        <div class="tile">
          <div class="tile-value">${escapeHtml(String(t.value))}</div>
          <div class="tile-label">${escapeHtml(t.label)}</div>
        </div>`,
    )
    .join("");

  return `<!doctype html><html lang="ar" dir="rtl"><head>
<meta charset="utf-8"/>
<title>${escapeHtml(opts.title)}</title>
<style>
  :root { --brand: #8b1538; --gold: #f2b824; --border: #e3dcd4; --muted: #6b6b6b; }
  * { box-sizing: border-box; }
  body { font-family: Tahoma, Arial, sans-serif; margin: 0; padding: 24px; color: #222; }
  .head { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid var(--brand); padding-bottom: 14px; margin-bottom: 18px; }
  .head img { width: 56px; height: 56px; }
  .head h1 { margin: 0; font-size: 20px; color: var(--brand); }
  .head p { margin: 2px 0 0; color: var(--muted); font-size: 13px; }
  .tiles { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 18px; }
  .tile { flex: 1 1 130px; border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; text-align: center; background: #fbf9f6; }
  .tile-value { font-size: 20px; font-weight: 800; color: var(--brand); }
  .tile-label { font-size: 12px; color: var(--muted); margin-top: 2px; }
  h2 { color: var(--brand); font-size: 15px; margin: 20px 0 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid var(--border); padding: 6px 8px; text-align: right; }
  th { background: #f7eef1; color: var(--brand); }
  tr:nth-child(even) td { background: #fbf9f6; }
  td.ltr { direction: ltr; text-align: right; font-variant-numeric: tabular-nums; }
  .foot { margin-top: 22px; padding-top: 8px; border-top: 1px solid var(--border); color: var(--muted); font-size: 11px; display: flex; justify-content: space-between; }
  @media print {
    body { padding: 10mm; }
    .no-print { display: none !important; }
  }
  .page-break { page-break-after: always; }
</style>
</head><body>
  <div class="head">
    <img src="/invite-poster.jpeg" alt="معرض رداء للأقمشة" />
    <div>
      <h1>${escapeHtml(opts.title)}</h1>
      ${opts.subtitle ? `<p>${escapeHtml(opts.subtitle)}</p>` : ""}
    </div>
  </div>
  ${tilesHtml ? `<div class="tiles">${tilesHtml}</div>` : ""}
  ${opts.sectionsHtml}
  <div class="foot">
    <span>المنصة</span>
    <span>تاريخ الطباعة: ${new Date().toLocaleString("ar-SA")}</span>
  </div>
  <script>window.onload = () => window.print();</script>
</body></html>`;
}

/**
 * خيارات أشكال عرض إحصائيات الاستبيان + توليد HTML للطباعة.
 * بلا مكتبات رسم — CSS/SVG فقط. ترتيب الكتل ثابت لمنع التداخل.
 */

import { escapeHtml } from "@/lib/print-html";
import type {
  SurveyOptionStats,
  SurveyQuestionStats,
  SurveyStatBucket,
  SurveyStatsResult,
  SurveyTextReply,
} from "@/lib/survey-stats";

export const SURVEY_STATS_VIEW_IDS = [
  "table",
  "bars",
  "pie",
  "avg",
  "stacked",
  "texts",
] as const;

export type SurveyStatsViewId = (typeof SURVEY_STATS_VIEW_IDS)[number];

export const SURVEY_STATS_VIEW_OPTIONS: Array<{
  id: SurveyStatsViewId;
  label: string;
}> = [
  { id: "table", label: "جدول" },
  { id: "bars", label: "أشرطة" },
  { id: "pie", label: "دائرة نسب" },
  { id: "avg", label: "متوسط" },
  { id: "stacked", label: "شريط مكدّس" },
  { id: "texts", label: "نصوص" },
];

export const SURVEY_STATS_VIEW_COLORS = [
  "#8b1538",
  "#c45c26",
  "#2f6f4e",
  "#2b5f8a",
  "#6b4c9a",
  "#a67c00",
  "#4a5568",
  "#b83280",
];

export function allStatsViews(): Set<SurveyStatsViewId> {
  return new Set(SURVEY_STATS_VIEW_IDS);
}

/** يحلّل views من نص مفصول بفواصل؛ إن فارغ/غير صالح → الكل. */
export function parseStatsViews(
  raw: string | null | undefined,
): Set<SurveyStatsViewId> {
  if (!raw || !raw.trim()) return allStatsViews();
  const next = new Set<SurveyStatsViewId>();
  for (const part of raw.split(",")) {
    const id = part.trim() as SurveyStatsViewId;
    if ((SURVEY_STATS_VIEW_IDS as readonly string[]).includes(id)) {
      next.add(id);
    }
  }
  return next.size ? next : allStatsViews();
}

export function serializeStatsViews(views: Set<SurveyStatsViewId>): string {
  return SURVEY_STATS_VIEW_IDS.filter((id) => views.has(id)).join(",");
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** شريحة قوس SVG من زاوية البداية للنهاية (درجات). */
export function pieSlicePath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const span = endAngle - startAngle;
  if (span >= 359.999) {
    return [
      `M ${cx} ${cy - r}`,
      `A ${r} ${r} 0 1 1 ${cx} ${cy + r}`,
      `A ${r} ${r} 0 1 1 ${cx} ${cy - r}`,
      "Z",
    ].join(" ");
  }
  const start = polar(cx, cy, r, endAngle);
  const end = polar(cx, cy, r, startAngle);
  const large = span > 180 ? 1 : 0;
  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

export function buildPieSvgMarkup(
  buckets: SurveyStatBucket[],
  size = 160,
): string {
  const answered = buckets.reduce((s, b) => s + b.count, 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;
  if (answered <= 0) {
    return `<svg class="ss-pie" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true"><circle cx="${cx}" cy="${cy}" r="${r}" fill="#eee"/></svg>`;
  }
  let angle = 0;
  const paths: string[] = [];
  buckets.forEach((b, i) => {
    if (b.count <= 0) return;
    const sweep = (b.count / answered) * 360;
    const d = pieSlicePath(cx, cy, r, angle, angle + sweep);
    const color = SURVEY_STATS_VIEW_COLORS[i % SURVEY_STATS_VIEW_COLORS.length]!;
    paths.push(`<path d="${d}" fill="${color}" />`);
    angle += sweep;
  });
  return `<svg class="ss-pie" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="دائرة نسب">${paths.join("")}</svg>`;
}

function legendHtml(buckets: SurveyStatBucket[]): string {
  return `<ul class="ss-legend">${buckets
    .map((b, i) => {
      const color = SURVEY_STATS_VIEW_COLORS[i % SURVEY_STATS_VIEW_COLORS.length]!;
      return `<li><span class="ss-swatch" style="background:${color}"></span><span class="ss-legend-label">${escapeHtml(b.label)}</span><span class="ss-legend-meta">${b.count} (${b.percent}%)</span></li>`;
    })
    .join("")}</ul>`;
}

function tableHtml(buckets: SurveyStatBucket[]): string {
  if (!buckets.length) return "";
  const rows = buckets
    .map(
      (b) =>
        `<tr><td class="ss-cell-label">${escapeHtml(b.label)}</td><td class="ss-cell-num">${b.count}</td><td class="ss-cell-num">${b.percent}%</td></tr>`,
    )
    .join("");
  return `<div class="ss-block"><h4 class="ss-block-title">جدول النسب</h4><table class="ss-table"><thead><tr><th>الإجابة</th><th>العدد</th><th>النسبة</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function barsHtml(buckets: SurveyStatBucket[]): string {
  if (!buckets.length) return "";
  const rows = buckets
    .map((b) => {
      const w = Math.min(100, Math.max(0, b.percent));
      return `<div class="ss-bar-row"><div class="ss-bar-label">${escapeHtml(b.label)}</div><div class="ss-bar-meta">${b.count} (${b.percent}%)</div><div class="ss-bar-track" aria-hidden="true"><div class="ss-bar-fill" style="width:${w}%"></div></div></div>`;
    })
    .join("");
  return `<div class="ss-block"><h4 class="ss-block-title">أشرطة أفقية</h4>${rows}</div>`;
}

function pieHtml(buckets: SurveyStatBucket[]): string {
  if (!buckets.length) return "";
  return `<div class="ss-block"><h4 class="ss-block-title">دائرة النسب</h4><div class="ss-pie-layout">${buildPieSvgMarkup(buckets)}${legendHtml(buckets)}</div></div>`;
}

function stackedHtml(buckets: SurveyStatBucket[]): string {
  if (!buckets.length) return "";
  const answered = buckets.reduce((s, b) => s + b.count, 0);
  if (answered <= 0) return "";
  const parts = buckets
    .filter((b) => b.count > 0)
    .map((b, i) => {
      const w = (b.count / answered) * 100;
      const color = SURVEY_STATS_VIEW_COLORS[i % SURVEY_STATS_VIEW_COLORS.length]!;
      return `<span class="ss-stack-seg" style="width:${w}%;background:${color}" title="${escapeHtml(b.label)}: ${b.percent}%"></span>`;
    })
    .join("");
  return `<div class="ss-block"><h4 class="ss-block-title">شريط مكدّس</h4><div class="ss-stack" aria-hidden="true">${parts}</div>${legendHtml(buckets)}</div>`;
}

function avgHtml(average: number | null, label = "المتوسط"): string {
  if (average == null) return "";
  return `<div class="ss-block ss-avg"><h4 class="ss-block-title">${escapeHtml(label)}</h4><div class="ss-avg-value">${average}</div></div>`;
}

function textsHtml(replies: SurveyTextReply[]): string {
  if (!replies.length) return "";
  const items = replies
    .map(
      (t) =>
        `<li><div class="ss-text-head"><strong>${escapeHtml(t.beneficiaryName)}</strong><span class="ltr">${escapeHtml(t.nationalId)}</span><span class="ltr">${escapeHtml(new Date(t.createdAt).toLocaleString("ar-SA"))}</span></div><p class="ss-text-body">${escapeHtml(t.text)}</p></li>`,
    )
    .join("");
  return `<div class="ss-block ss-texts"><h4 class="ss-block-title">الردود النصية (${replies.length})</h4><ul class="ss-texts-list">${items}</ul></div>`;
}

function bucketViewsHtml(
  buckets: SurveyStatBucket[],
  views: Set<SurveyStatsViewId>,
  average: number | null,
  avgLabel?: string,
): string {
  let html = "";
  if (views.has("avg")) html += avgHtml(average, avgLabel);
  if (views.has("table")) html += tableHtml(buckets);
  if (views.has("bars")) html += barsHtml(buckets);
  if (views.has("pie")) html += pieHtml(buckets);
  if (views.has("stacked")) html += stackedHtml(buckets);
  return html;
}

function optionBlockHtml(
  opt: SurveyOptionStats,
  views: Set<SurveyStatsViewId>,
): string {
  return `<div class="ss-option"><h3 class="ss-option-title">${escapeHtml(opt.option)}</h3>${bucketViewsHtml(opt.buckets, views, opt.average, "متوسط الخيار")}</div>`;
}

/** HTML لسؤال واحد بترتيب الكتل الثابت دون تداخل. */
export function buildQuestionStatsPrintHtml(
  q: SurveyQuestionStats,
  views: Set<SurveyStatsViewId>,
): string {
  let body = `<p class="ss-meta">مجيبون: ${q.answeredCount}</p>`;

  if (q.optionStats?.length) {
    body += q.optionStats.map((o) => optionBlockHtml(o, views)).join("");
  } else if (q.buckets.length) {
    body += bucketViewsHtml(q.buckets, views, q.average);
  }

  if (views.has("texts")) {
    if (q.textReplies.length) body += textsHtml(q.textReplies);
    else if (q.questionType === "text") {
      body += `<p class="ss-meta">لا ردود نصية.</p>`;
    }
  }

  return `<section class="ss-question"><h2 class="ss-question-title">${escapeHtml(q.questionText)}</h2>${body}</section>`;
}

export const SURVEY_STATS_PRINT_CSS = `
.ss-question { page-break-inside: avoid; margin: 0 0 22px; }
.ss-question-title { font-size: 15px; margin: 0 0 6px; overflow-wrap: anywhere; }
.ss-meta { color: #6b6b6b; font-size: 12px; margin: 0 0 10px; }
.ss-block { margin: 0 0 14px; clear: both; }
.ss-block-title { font-size: 12px; margin: 0 0 8px; color: #555; font-weight: 700; }
.ss-option { margin: 0 0 16px; padding-top: 8px; border-top: 1px solid #eee; }
.ss-option-title { font-size: 13px; margin: 0 0 8px; overflow-wrap: anywhere; }
.ss-avg-value { font-size: 28px; font-weight: 800; color: #8b1538; line-height: 1.2; }
.ss-table { width: 100%; border-collapse: collapse; font-size: 12px; table-layout: fixed; }
.ss-table th, .ss-table td { border: 1px solid #e3dcd4; padding: 6px 8px; text-align: right; vertical-align: top; }
.ss-table th { background: #f7eef1; color: #8b1538; }
.ss-cell-label { overflow-wrap: anywhere; width: 55%; }
.ss-cell-num { width: 22.5%; white-space: nowrap; }
.ss-bar-row { margin: 0 0 10px; }
.ss-bar-label { font-size: 12px; overflow-wrap: anywhere; margin: 0 0 2px; }
.ss-bar-meta { font-size: 11px; color: #666; margin: 0 0 4px; }
.ss-bar-track { height: 10px; background: #f0ebe6; border-radius: 999px; overflow: hidden; }
.ss-bar-fill { height: 100%; background: #8b1538; border-radius: 999px; }
.ss-pie-layout { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; }
.ss-pie { flex: 0 0 auto; display: block; }
.ss-legend { list-style: none; margin: 0; padding: 0; flex: 1 1 180px; }
.ss-legend li { display: flex; gap: 8px; align-items: flex-start; margin: 0 0 6px; font-size: 12px; }
.ss-swatch { width: 12px; height: 12px; border-radius: 3px; flex: 0 0 auto; margin-top: 3px; }
.ss-legend-label { flex: 1 1 auto; overflow-wrap: anywhere; }
.ss-legend-meta { flex: 0 0 auto; white-space: nowrap; color: #666; }
.ss-stack { display: flex; width: 100%; height: 16px; border-radius: 8px; overflow: hidden; background: #f0ebe6; margin-bottom: 8px; }
.ss-stack-seg { display: block; height: 100%; min-width: 0; }
.ss-texts-list { list-style: none; margin: 0; padding: 0; }
.ss-texts-list > li { border: 1px solid #e3dcd4; border-radius: 8px; padding: 8px 10px; margin: 0 0 8px; page-break-inside: avoid; }
.ss-text-head { display: flex; flex-wrap: wrap; gap: 6px 12px; font-size: 11px; margin-bottom: 4px; }
.ss-text-body { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.55; font-size: 12px; }
.ltr { direction: ltr; unicode-bidi: isolate; }
@media print {
  .ss-question, .ss-texts-list > li, .ss-block { page-break-inside: avoid; }
}
`;

export function buildStatsReportSectionsHtml(
  stats: SurveyStatsResult,
  views: Set<SurveyStatsViewId>,
): string {
  const sections = stats.questions
    .map((q) => buildQuestionStatsPrintHtml(q, views))
    .join("\n");
  return `<style>${SURVEY_STATS_PRINT_CSS}</style>${
    sections || "<p>لا أسئلة في هذا الاستبيان.</p>"
  }`;
}

import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { requireActiveExhibition } from "@/lib/exhibition";
import { findSurvey, parseSurveyCatalog } from "@/lib/survey-questions";
import {
  computeSurveyStats,
  type SurveyStatsResult,
} from "@/lib/survey-stats";
import { buildPrintDocument, escapeHtml } from "@/lib/print-html";
import { writeAuditLog } from "@/lib/audit";

const MAX_RESPONSES = 10_000;

function contentDispositionUtf8(filename: string): string {
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="survey-stats.xlsx"; filename*=UTF-8''${encoded}`;
}

function applyRtlSheet(ws: ExcelJS.Worksheet) {
  ws.views = [{ rightToLeft: true, state: "normal", showGridLines: true }];
  ws.properties.defaultColWidth = 18;
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { name: "Arial", bold: true, size: 12 };
  row.alignment = { horizontal: "right", vertical: "middle" };
}

function styleCell(cell: ExcelJS.Cell) {
  cell.font = { name: "Arial", size: 11 };
  cell.alignment = { horizontal: "right", vertical: "middle", wrapText: true };
}

async function loadStats(surveyIdParam: string | null) {
  let exhibition;
  try {
    exhibition = await requireActiveExhibition();
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "لا يوجد معرض نشط",
      status: 400 as const,
    };
  }

  const catalog = parseSurveyCatalog(exhibition.settings?.surveyQuestionsJson);
  const survey =
    findSurvey(catalog, surveyIdParam) ?? catalog.surveys[0] ?? null;
  if (!survey) {
    return { error: "لا يوجد استبيان", status: 404 as const };
  }

  const rows = await prisma.surveyResponse.findMany({
    where: { exhibitionId: exhibition.id, surveyId: survey.id },
    include: { beneficiary: { select: { name: true, nationalId: true } } },
    orderBy: { createdAt: "desc" },
    take: MAX_RESPONSES,
  });

  const stats = computeSurveyStats({
    surveyId: survey.id,
    surveyTitle: survey.title,
    questions: survey.questions,
    responses: rows.map((r) => ({
      id: r.id,
      answersJson: r.answersJson,
      createdAt: r.createdAt,
      beneficiary: {
        name: r.beneficiary.name,
        nationalId: r.beneficiary.nationalId,
      },
    })),
  });

  return {
    exhibitionId: exhibition.id,
    exhibitionName: exhibition.name,
    stats,
  };
}

async function buildXlsxBuffer(
  exhibitionName: string,
  stats: SurveyStatsResult,
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "رداء";

  const summary = wb.addWorksheet("الملخص");
  applyRtlSheet(summary);
  summary.addRow(["المعرض", exhibitionName]);
  summary.addRow(["الاستبيان", stats.surveyTitle]);
  summary.addRow(["عدد الردود", stats.totalResponses]);
  summary.addRow(["عدد الأسئلة", stats.questions.length]);
  summary.eachRow((row) => row.eachCell((cell) => styleCell(cell)));
  styleHeader(summary.getRow(1));

  const ratios = wb.addWorksheet("النسب");
  applyRtlSheet(ratios);
  styleHeader(
    ratios.addRow([
      "السؤال",
      "النوع",
      "الخيار / القيمة",
      "العدد",
      "النسبة %",
      "عدد المجيبين",
    ]),
  );

  for (const q of stats.questions) {
    if (q.optionStats?.length) {
      for (const opt of q.optionStats) {
        for (const b of opt.buckets) {
          const row = ratios.addRow([
            q.questionText,
            q.questionType,
            `${opt.option} → ${b.label}`,
            b.count,
            b.percent,
            opt.answeredCount,
          ]);
          row.eachCell((cell) => styleCell(cell));
        }
      }
    } else if (q.buckets.length) {
      for (const b of q.buckets) {
        const row = ratios.addRow([
          q.questionText,
          q.questionType,
          b.label,
          b.count,
          b.percent,
          q.answeredCount,
        ]);
        row.eachCell((cell) => styleCell(cell));
      }
    } else {
      const row = ratios.addRow([
        q.questionText,
        q.questionType,
        "—",
        q.answeredCount,
        q.answeredCount ? 100 : 0,
        q.answeredCount,
      ]);
      row.eachCell((cell) => styleCell(cell));
    }
  }

  const texts = wb.addWorksheet("النصوص");
  applyRtlSheet(texts);
  styleHeader(
    texts.addRow(["السؤال", "المستفيد", "الهوية", "النص", "التاريخ"]),
  );
  for (const q of stats.questions) {
    for (const t of q.textReplies) {
      const row = texts.addRow([
        q.questionText,
        t.beneficiaryName,
        t.nationalId,
        t.text,
        new Date(t.createdAt).toLocaleString("ar-SA"),
      ]);
      row.eachCell((cell) => styleCell(cell));
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}

function buildStatsPrintHtml(
  exhibitionName: string,
  stats: SurveyStatsResult,
): string {
  const sections: string[] = [];

  for (const q of stats.questions) {
    let body = `<p class="muted">مجيبون: ${q.answeredCount}</p>`;

    if (q.optionStats?.length) {
      body += q.optionStats
        .map((opt) => {
          const rows = opt.buckets
            .map(
              (b) =>
                `<tr><td>${escapeHtml(b.label)}</td><td>${b.count}</td><td>${b.percent}%</td></tr>`,
            )
            .join("");
          return `<h3>${escapeHtml(opt.option)}</h3>
            <table><thead><tr><th>التقييم</th><th>العدد</th><th>النسبة</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="3">لا بيانات</td></tr>`}</tbody></table>`;
        })
        .join("");
    } else if (q.buckets.length) {
      const rows = q.buckets
        .map(
          (b) =>
            `<tr><td>${escapeHtml(b.label)}</td><td>${b.count}</td><td>${b.percent}%</td></tr>`,
        )
        .join("");
      body += `<table><thead><tr><th>الإجابة</th><th>العدد</th><th>النسبة</th></tr></thead>
        <tbody>${rows}</tbody></table>`;
    }

    if (q.textReplies.length) {
      const rows = q.textReplies
        .map(
          (t) =>
            `<tr><td>${escapeHtml(t.beneficiaryName)}</td><td class="ltr">${escapeHtml(t.nationalId)}</td><td>${escapeHtml(t.text)}</td><td class="ltr">${escapeHtml(new Date(t.createdAt).toLocaleString("ar-SA"))}</td></tr>`,
        )
        .join("");
      body += `<h3>الردود النصية (${q.textReplies.length})</h3>
        <table><thead><tr><th>المستفيد</th><th>الهوية</th><th>النص</th><th>التاريخ</th></tr></thead>
        <tbody>${rows}</tbody></table>`;
    } else if (q.questionType === "text") {
      body += `<p>لا ردود نصية.</p>`;
    }

    sections.push(
      `<section style="page-break-inside:avoid"><h2>${escapeHtml(q.questionText)}</h2>${body}</section>`,
    );
  }

  return buildPrintDocument({
    title: `إحصائيات: ${stats.surveyTitle}`,
    subtitle: `${exhibitionName} — عدد الردود: ${stats.totalResponses}`,
    tiles: [
      { label: "الردود", value: stats.totalResponses },
      { label: "الأسئلة", value: stats.questions.length },
    ],
    sectionsHtml: `
      <style>
        .muted { color: #6b6b6b; font-size: 12px; }
        h3 { font-size: 13px; margin: 12px 0 6px; color: #444; }
        @media print { section { page-break-inside: avoid; } }
      </style>
      ${sections.join("\n") || "<p>لا أسئلة في هذا الاستبيان.</p>"}
      <p class="no-print" style="margin-top:12px">
        <button type="button" onclick="window.print()" style="padding:8px 16px;cursor:pointer">طباعة</button>
      </p>`,
  });
}

/**
 * إحصائيات استبيان: json | xlsx | pdf — O(n) بعدد الردود.
 */
export async function GET(req: NextRequest) {
  const authz = await requirePermission("survey:manage");
  if ("error" in authz) return authz.error;

  const surveyId = req.nextUrl.searchParams.get("surveyId");
  const format = (req.nextUrl.searchParams.get("format") ?? "json").toLowerCase();

  const loaded = await loadStats(surveyId);
  if ("error" in loaded) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  const { exhibitionId, exhibitionName, stats } = loaded;

  if (format === "json") {
    return NextResponse.json({ exhibitionId, exhibitionName, ...stats });
  }

  if (format === "xlsx") {
    const buf = await buildXlsxBuffer(exhibitionName, stats);
    await writeAuditLog({
      userId: authz.userId,
      action: "SURVEY_STATS_EXPORT",
      entityType: "SurveyResponse",
      entityId: stats.surveyId,
      meta: { format: "xlsx", totalResponses: stats.totalResponses },
    });
    return new NextResponse(buf, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": contentDispositionUtf8(
          `إحصائيات-${stats.surveyTitle}.xlsx`,
        ),
      },
    });
  }

  if (format === "pdf") {
    const html = buildStatsPrintHtml(exhibitionName, stats);
    await writeAuditLog({
      userId: authz.userId,
      action: "SURVEY_STATS_PRINT",
      entityType: "SurveyResponse",
      entityId: stats.surveyId,
      meta: { format: "pdf", totalResponses: stats.totalResponses },
    });
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json({ error: "صيغة غير مدعومة" }, { status: 400 });
}

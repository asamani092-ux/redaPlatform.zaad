import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { requireActiveExhibition } from "@/lib/exhibition";
import {
  findSurvey,
  parseSurveyCatalog,
  type SurveyQuestion,
} from "@/lib/survey-questions";
import { buildPrintDocument, escapeHtml } from "@/lib/print-html";
import { writeAuditLog } from "@/lib/audit";

function formatAnswers(
  answers: Record<string, unknown> | null | undefined,
  questions: SurveyQuestion[],
): string {
  const entries = Object.entries(answers ?? {});
  if (!entries.length) return "—";
  return entries
    .map(([k, v]) => {
      const label = questions.find((q) => q.id === k)?.text ?? k;
      return `<div class="ans"><b>${escapeHtml(label)}:</b> ${escapeHtml(String(v ?? "—"))}</div>`;
    })
    .join("");
}

/**
 * طباعة ردود الاستبيان بهوية المنصة — O(n) بعدد الردود.
 */
export async function GET(req: NextRequest) {
  const authz = await requirePermission("survey:manage");
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

  const catalog = parseSurveyCatalog(exhibition.settings?.surveyQuestionsJson);
  const survey =
    findSurvey(catalog, req.nextUrl.searchParams.get("surveyId")) ??
    catalog.surveys[0] ??
    null;
  const questions: SurveyQuestion[] = survey?.questions ?? [];
  const responses = await prisma.surveyResponse.findMany({
    where: {
      exhibitionId: exhibition.id,
      ...(survey ? { surveyId: survey.id } : {}),
    },
    include: { beneficiary: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const rowsHtml = responses
    .map((r, idx) => {
      const answers =
        r.answersJson && typeof r.answersJson === "object" && !Array.isArray(r.answersJson)
          ? (r.answersJson as Record<string, unknown>)
          : {};
      return `<tr>
        <td>${idx + 1}</td>
        <td>${escapeHtml(r.beneficiary.name)}</td>
        <td class="ltr">${escapeHtml(r.beneficiary.nationalId)}</td>
        <td class="ltr">${escapeHtml(r.beneficiary.mobile)}</td>
        <td>${formatAnswers(answers, questions)}</td>
        <td class="ltr">${escapeHtml(new Date(r.createdAt).toLocaleString("ar-SA"))}</td>
      </tr>`;
    })
    .join("");

  const html = buildPrintDocument({
    title: `ردود ${survey?.title ?? "الاستبيان"}: ${exhibition.name}`,
    subtitle: exhibition.location
      ? `الموقع: ${exhibition.location} — عدد الردود: ${responses.length}`
      : `عدد الردود: ${responses.length}`,
    tiles: [{ label: "عدد الردود", value: responses.length }],
    sectionsHtml: `
      <style>
        .ans { margin: 0.15rem 0; }
        .ans b { color: var(--brand); }
        @media print { tr { page-break-inside: avoid; } }
      </style>
      <h2>قائمة الردود</h2>
      ${
        responses.length
          ? `<table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>المستفيد</th>
                  <th>الهوية</th>
                  <th>الجوال</th>
                  <th>الإجابات</th>
                  <th>التاريخ</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>`
          : `<p>لا ردود بعد لهذا المعرض.</p>`
      }
      <p class="no-print" style="margin-top:12px">
        <button onclick="window.print()" style="padding:8px 16px;cursor:pointer">طباعة</button>
      </p>`,
  });

  await writeAuditLog({
    userId: authz.userId,
    action: "SURVEY_PRINT",
    entityType: "SurveyResponse",
    entityId: exhibition.id,
    meta: {
      count: responses.length,
      format: "print-html",
      surveyId: survey?.id ?? null,
    },
  });

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

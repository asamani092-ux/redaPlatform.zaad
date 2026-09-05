/**
 * اختبارات تكييف أنواع KPI وإخفاء الأقسام الفارغة وتقسيم الشرائح.
 */
import assert from "node:assert/strict";
import {
  PRESENTATION_KPI_OPTIONS,
  REPORT_KPI_LABELS,
} from "../src/lib/report-kpi-labels";
import {
  adaptPresentationKpiKind,
  buildZadPresentationReport,
  chunkPages,
  finalizePresentationKpis,
  isEmptyPresentationKpi,
  PRESENTATION_SLIDE_LIMITS,
  type PresentationKpi,
} from "../src/lib/zad-presentation-report";

console.log("=== presentation kpi kinds ===");

// pair: أسرة + أفراد
{
  const k = adaptPresentationKpiKind({
    label: "أسر وأفراد",
    value: "10",
    families: 10,
    individuals: 25,
    rows: [
      ["الأسر المسجّلة", "١٠"],
      ["إجمالي الأفراد", "٢٥"],
    ],
  });
  assert.equal(k.kind, "pair");
}

// progress: نسبة
{
  const k = adaptPresentationKpiKind({
    label: REPORT_KPI_LABELS.attendanceFromInvitedPct,
    value: "٥٠٪",
    pct: 50,
    rows: [
      ["حاضر", "5"],
      ["مدعو", "10"],
    ],
  });
  assert.equal(k.kind, "progress");
  assert.equal(k.pct, 50);
}

// hero: رقم مفرد
{
  const k = adaptPresentationKpiKind({
    label: "إجمالي",
    value: "120",
    rows: [["إجمالي", "120"]],
  });
  assert.equal(k.kind, "hero");
}

// ranking: قائمة مرتبة من ملاحظة أعلى الأصناف
{
  const k = adaptPresentationKpiKind({
    label: REPORT_KPI_LABELS.piecesDispensed,
    value: "50",
    rows: [
      ["صنف أ", "20"],
      ["صنف ب", "15"],
      ["صنف ج", "10"],
    ],
    items: [
      ["صنف أ", "20"],
      ["صنف ب", "15"],
      ["صنف ج", "10"],
    ],
    note: "أعلى الأصناف المصروفة.",
  });
  assert.equal(k.kind, "ranking");
}

// miniGrid: 3–6 عناصر
{
  const k = adaptPresentationKpiKind({
    label: "مخزون",
    value: "1",
    items: [
      ["أ", "1"],
      ["ب", "2"],
      ["ج", "3"],
    ],
    rows: [
      ["أ", "1"],
      ["ب", "2"],
      ["ج", "3"],
    ],
  });
  assert.equal(k.kind, "miniGrid");
}

// إخفاء progress بمقام صفري
{
  const emptyProg: PresentationKpi = {
    label: "نسبة",
    value: "٠٪",
    kind: "progress",
    pct: Number.NaN,
    rows: [
      ["حاضر", "0"],
      ["مدعو", "0"],
    ],
  };
  assert.equal(isEmptyPresentationKpi(emptyProg), true);
}

// إخفاء ranking فارغ
{
  assert.equal(
    isEmptyPresentationKpi({
      label: "ترتيب",
      value: "",
      kind: "ranking",
      rows: [],
      items: [],
    }),
    true,
  );
}

// عنصر واحد في ranking → hero بعد finalize
{
  const out = finalizePresentationKpis([
    {
      label: "أصناف",
      value: "5",
      items: [["صنف واحد", "5"]],
      rows: [["صنف واحد", "5"]],
      note: "أعلى الأصناف المصروفة.",
    },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.kind, "hero");
}

// تقسيم miniGrid عند تجاوز 6
{
  const items: [string, string][] = Array.from({ length: 8 }, (_, i) => [
    `صنف ${i + 1}`,
    String(i + 1),
  ]);
  const out = finalizePresentationKpis([
    {
      label: "شبكة",
      value: "8",
      items,
      rows: items,
    },
  ]);
  assert.ok(out.length >= 2);
  assert.equal(out[0]!.kind, "miniGrid");
  assert.ok(out[0]!.items!.length <= PRESENTATION_SLIDE_LIMITS.miniGridItems);
  assert.ok(out.some((k) => k.label.includes("(")));
}

// chunkPages
{
  const pages = chunkPages([1, 2, 3, 4, 5], 3);
  assert.deepEqual(pages, [
    [1, 2, 3],
    [4, 5],
  ]);
}

// بناء التقرير يعيّن kinds ويطابق خيارات العرض
{
  const report = buildZadPresentationReport({
    exhibitionName: "تجريبي",
    exhibitionActive: true,
    totalBeneficiaries: 100,
    invited: 80,
    attended: 50,
    received: 40,
    piecesDispensed: 120,
    beneficiaryFamilies: 100,
    totalIndividuals: 250,
    invitedIndividuals: 200,
    attendedIndividuals: 130,
    receivedIndividuals: 110,
    attendedNotReceived: 10,
    attendanceFromInvitedPct: 62.5,
    receivedFromAttendedPct: 80,
    clothesPieces: 90,
    fabricMeters: 30,
    repeatDispenseFamilies: 2,
    platformContributed: 10,
    platformDispensed: 4,
    platformRemaining: 6,
    storeContributed: 20,
    storeDispensed: 8,
    storeRemaining: 12,
    topItems: [
      { skuCode: "A", quantity: 40, attributes: { type: "قميص" } },
      { skuCode: "B", quantity: 30, attributes: { type: "ثوب" } },
      { skuCode: "C", quantity: 20, attributes: { type: "حذاء" } },
    ],
  });

  assert.ok(report.kpis.every((k) => k.kind));
  assert.ok(report.kpis.some((k) => k.kind === "pair"));
  assert.ok(report.kpis.some((k) => k.kind === "progress"));

  const baseLabels = new Set(
    report.kpis.map((k) => k.label.replace(/\s*\([٠-٩0-9]+\)\s*$/, "").trim()),
  );
  for (const opt of PRESENTATION_KPI_OPTIONS) {
    assert.ok(baseLabels.has(opt), `خيار العرض غير مبني كمؤشر: ${opt}`);
  }
}

// إخفاء نسب الحضور عند عدم وجود مدعوين
{
  const report = buildZadPresentationReport({
    exhibitionName: "فارغ",
    exhibitionActive: false,
    totalBeneficiaries: 5,
    invited: 0,
    attended: 0,
    received: 0,
    piecesDispensed: 0,
    beneficiaryFamilies: 5,
    totalIndividuals: 12,
  });
  assert.ok(
    !report.kpis.some((k) => k.label === REPORT_KPI_LABELS.attendanceFromInvitedPct),
  );
  assert.ok(
    !report.kpis.some((k) => k.label === REPORT_KPI_LABELS.receivedFromAttendedPct),
  );
}

console.log("presentation-kpi-kinds.unit: ok");

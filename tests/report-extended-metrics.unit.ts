/**
 * اختبارات وحدة للمقاييس الموسّعة وتسميات التقارير.
 */
import assert from "node:assert/strict";
import {
  attendedNotReceivedCount,
  attendanceByHourRows,
  buildAttendanceByHour,
  countRepeatDispenseFamilies,
  pctRate,
  riyadhHour,
  sumIndividualsFromDependents,
} from "../src/lib/report-extended-metrics";
import {
  dispenseKind,
  sumClothesAndFabric,
} from "../src/lib/dispense-kind";
import {
  FUNNEL_NOTE,
  PRESENTATION_KPI_OPTIONS,
  REPORT_KPI_LABELS,
} from "../src/lib/report-kpi-labels";
import { buildZadPresentationReport } from "../src/lib/zad-presentation-report";

assert.equal(attendedNotReceivedCount(10, 4), 6);
assert.equal(attendedNotReceivedCount(3, 5), 0);
assert.equal(pctRate(1, 4), 25);
assert.equal(pctRate(1, 0), 0);
assert.equal(sumIndividualsFromDependents([0, 2, 3]), 1 + 3 + 4);
assert.equal(countRepeatDispenseFamilies([1, 2, 1, 5]), 2);
assert.equal(countRepeatDispenseFamilies([1, 1]), 0);

assert.equal(dispenseKind({ type: "ملابس رجالية", unit: "" }), "clothes");
assert.equal(dispenseKind({ type: "", unit: "متر" }), "fabric");
assert.equal(dispenseKind({ type: "أخرى", unit: "علبة" }), "other");

const summed = sumClothesAndFabric([
  { quantity: 2, attributes: { type: "ملابس", unit: "قطعة" } },
  { quantity: 1.5, attributes: { type: "قماش", unit: "متر" } },
  { quantity: 3, attributes: { type: "هدية", unit: "علبة" } },
]);
assert.equal(summed.clothesPieces, 5);
assert.equal(summed.fabricMeters, 1.5);

// 2026-03-15 10:30 Asia/Riyadh = 07:30 UTC
const hour = riyadhHour("2026-03-15T07:30:00.000Z");
assert.equal(hour, 10);
const buckets = buildAttendanceByHour([
  "2026-03-15T07:30:00.000Z",
  "2026-03-15T07:45:00.000Z",
  "2026-03-15T08:00:00.000Z",
]);
assert.equal(buckets[10], 2);
assert.equal(buckets[11], 1);
const rows = attendanceByHourRows(buckets).filter((r) => r.count > 0);
assert.equal(rows.length, 2);

assert.ok(PRESENTATION_KPI_OPTIONS.includes(REPORT_KPI_LABELS.attendedNotReceived));
assert.ok(FUNNEL_NOTE.includes("الأسر"));

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
});

assert.ok(report.kpis.some((k) => k.label === REPORT_KPI_LABELS.attendedNotReceived));
assert.ok(report.kpis.some((k) => k.label === REPORT_KPI_LABELS.clothesPieces));
assert.equal(report.funnel.length, 4);
for (const stage of report.funnel) {
  assert.ok(stage.rows.some((r) => r[0] === "أسر"));
  assert.ok(stage.rows.some((r) => r[0] === "أفراد"));
}
assert.ok(report.progress.some((p) => p.label === REPORT_KPI_LABELS.attendanceFromInvitedPct));

// فلترة مؤشرات العرض بالمساواة النصية
const labels = new Set(report.kpis.map((k) => k.label));
for (const opt of PRESENTATION_KPI_OPTIONS) {
  assert.ok(labels.has(opt), `خيار العرض غير مبني كمؤشر: ${opt}`);
}

console.log("report-extended-metrics.unit: ok");

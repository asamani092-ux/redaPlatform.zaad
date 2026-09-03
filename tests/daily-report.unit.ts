import { assert } from "./helpers";
import { exhibitionDays, riyadhDateKey } from "../src/lib/exhibition-days";
import { buildDailyReportMetrics } from "../src/lib/daily-report-metrics";

console.log("=== exhibition days (Asia/Riyadh) ===");

const days = exhibitionDays({
  startsAt: new Date("2026-03-01T00:00:00Z"),
  endsAt: new Date("2026-03-03T00:00:00Z"),
});
assert(days.length === 3, `expected 3 days, got ${days.length}`);
assert(days[0].dateKey === "2026-03-01", `day1 key ${days[0].dateKey}`);
assert(days[2].dateKey === "2026-03-03", `day3 key ${days[2].dateKey}`);
assert(days[1].dayIndex === 2, "day index is 1-based");
assert(days[1].label === "اليوم 2", `label ${days[1].label}`);
console.log("OK days:", days.map((d) => `${d.label}=${d.dateKey}`).join(", "));

// 21:30 UTC = 00:30 اليوم التالي بتوقيت الرياض (+3)
assert(
  riyadhDateKey(new Date("2026-03-01T21:30:00Z")) === "2026-03-02",
  "Riyadh offset must roll the calendar day forward",
);
assert(
  riyadhDateKey(new Date("2026-03-01T20:59:00Z")) === "2026-03-01",
  "before 21:00 UTC stays on the same Riyadh day",
);
console.log("OK Riyadh day boundary");

assert(
  exhibitionDays({ startsAt: "2026-03-05", endsAt: null }).length === 1,
  "start without end yields a single day",
);
assert(
  exhibitionDays({ startsAt: "2026-03-05", endsAt: "2026-03-01" }).length === 0,
  "end before start yields no days",
);
assert(exhibitionDays({ startsAt: null, endsAt: null }).length === 0, "no period");

console.log("=== daily metrics ===");

const metrics = buildDailyReportMetrics({
  days,
  invites: [
    { beneficiaryId: "b1", inviteDate: new Date("2026-03-01T00:00:00Z") },
    { beneficiaryId: "b2", inviteDate: new Date("2026-03-01T00:00:00Z") },
    { beneficiaryId: "b3", inviteDate: new Date("2026-03-01T00:00:00Z") },
    { beneficiaryId: "b4", inviteDate: new Date("2026-03-02T00:00:00Z") },
    { beneficiaryId: "b5", inviteDate: null },
    { beneficiaryId: "b6", inviteDate: new Date("2026-04-20T00:00:00Z") },
  ],
  attendances: [
    // حضر بنفس يوم دعوته
    { beneficiaryId: "b1", checkedInAt: new Date("2026-03-01T13:00:00Z") },
    // مدعو لليوم الأول وحضر في اليوم الثاني
    { beneficiaryId: "b2", checkedInAt: new Date("2026-03-02T13:00:00Z") },
    // حضور بلا دعوة لليوم (استثنائي)
    { beneficiaryId: "b9", checkedInAt: new Date("2026-03-03T13:00:00Z") },
    // حضور خارج فترة المعرض
    { beneficiaryId: "b8", checkedInAt: new Date("2026-04-20T13:00:00Z") },
  ],
});

const [d1, d2, d3] = metrics.byDay;
assert(d1.invitedForDay === 3, `day1 invited ${d1.invitedForDay}`);
assert(d1.attendedOnDay === 1, `day1 attended ${d1.attendedOnDay}`);
assert(d1.matched === 1, `day1 matched ${d1.matched}`);
assert(d1.dayMismatch === 1, `day1 mismatch ${d1.dayMismatch}`);
assert(d1.absent === 1, `day1 absent ${d1.absent}`);
assert(d2.invitedForDay === 1, `day2 invited ${d2.invitedForDay}`);
assert(d2.attendedOnDay === 1, `day2 attended ${d2.attendedOnDay}`);
assert(d2.matched === 0, `day2 matched ${d2.matched}`);
assert(d3.attendedOnDay === 1, `day3 attended ${d3.attendedOnDay}`);
assert(d3.invitedForDay === 0, `day3 invited ${d3.invitedForDay}`);
assert(
  metrics.invitedWithoutDate === 2,
  `invitedWithoutDate ${metrics.invitedWithoutDate}`,
);
assert(
  metrics.attendedOutsideDays === 1,
  `attendedOutsideDays ${metrics.attendedOutsideDays}`,
);

for (const row of metrics.byDay) {
  assert(
    row.matched + row.dayMismatch + row.absent === row.invitedForDay,
    `${row.label}: invited must split into matched/mismatch/absent`,
  );
}

console.log(
  "OK daily metrics:",
  metrics.byDay
    .map(
      (r) =>
        `${r.label} دعوة=${r.invitedForDay} حضور=${r.attendedOnDay} مطابق=${r.matched} مختلف=${r.dayMismatch}`,
    )
    .join(" | "),
);

console.log("DAILY REPORT UNIT TESTS PASSED");

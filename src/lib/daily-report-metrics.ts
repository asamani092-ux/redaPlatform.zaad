/** مقاييس التقارير اليومية — مطابقة يوم الدعوة بيوم الحضور بتوقيت الرياض */

import { riyadhDateKey, type ExhibitionDay } from "@/lib/exhibition-days";

export type DailyInviteInput = {
  beneficiaryId: string;
  inviteDate: Date | string | null;
};

export type DailyAttendanceInput = {
  beneficiaryId: string;
  checkedInAt: Date | string;
};

export type DailyReportMetrics = {
  dayIndex: number;
  dateKey: string;
  label: string;
  /** مدعوون تاريخ دعوتهم يطابق هذا اليوم */
  invitedForDay: number;
  /** حضور اليوم — وقت تسجيل الحضور يقع في هذا اليوم (المؤشر الأساسي) */
  attendedOnDay: number;
  /** مدعوون لهذا اليوم وحضروا فيه فعلاً */
  matched: number;
  /** مدعوون لهذا اليوم لكن حضروا في يوم آخر من أيام المعرض */
  dayMismatch: number;
  /** مدعوون لهذا اليوم بلا حضور مسجّل ضمن أيام المعرض */
  absent: number;
};

export type DailyReportBreakdown = {
  byDay: DailyReportMetrics[];
  /** دعوات بلا تاريخ حضور محدد — لا تُنسب لأي يوم */
  invitedWithoutDate: number;
  /** حضور خارج أيام المعرض المعرّفة (فترة المعرض غير مضبوطة) */
  attendedOutsideDays: number;
};

/**
 * بناء مقاييس كل يوم من أيام المعرض.
 * Time: O(a + i + d) — مرور واحد على الحضور والدعوات والأيام؛ Space: O(a + d).
 */
export function buildDailyReportMetrics(input: {
  days: ExhibitionDay[];
  invites: DailyInviteInput[];
  attendances: DailyAttendanceInput[];
}): DailyReportBreakdown {
  const byDay: DailyReportMetrics[] = input.days.map((d) => ({
    dayIndex: d.dayIndex,
    dateKey: d.dateKey,
    label: d.label,
    invitedForDay: 0,
    attendedOnDay: 0,
    matched: 0,
    dayMismatch: 0,
    absent: 0,
  }));

  const indexByKey = new Map<string, number>();
  byDay.forEach((d, i) => indexByKey.set(d.dateKey, i));

  // يوم الحضور لكل مستفيد — الحضور فريد لكل مستفيد داخل المعرض
  const attendanceDayByBeneficiary = new Map<string, string>();
  let attendedOutsideDays = 0;
  for (const a of input.attendances) {
    const key = riyadhDateKey(a.checkedInAt);
    if (!key) continue;
    attendanceDayByBeneficiary.set(a.beneficiaryId, key);
    const idx = indexByKey.get(key);
    if (idx === undefined) {
      attendedOutsideDays++;
      continue;
    }
    byDay[idx].attendedOnDay++;
  }

  let invitedWithoutDate = 0;
  for (const inv of input.invites) {
    const key = riyadhDateKey(inv.inviteDate);
    if (!key) {
      invitedWithoutDate++;
      continue;
    }
    const idx = indexByKey.get(key);
    if (idx === undefined) {
      invitedWithoutDate++;
      continue;
    }
    const row = byDay[idx];
    row.invitedForDay++;
    const attendedKey = attendanceDayByBeneficiary.get(inv.beneficiaryId);
    if (attendedKey === key) row.matched++;
    else if (attendedKey && indexByKey.has(attendedKey)) row.dayMismatch++;
  }

  for (const row of byDay) {
    row.absent = row.invitedForDay - row.matched - row.dayMismatch;
  }

  return { byDay, invitedWithoutDate, attendedOutsideDays };
}

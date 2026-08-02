export type ExhibitionLifecycle = "active" | "upcoming" | "running" | "ended" | "inactive";

export const EXHIBITION_STATUS_LABELS: Record<ExhibitionLifecycle, string> = {
  active: "نشط تشغيلياً",
  upcoming: "قادم",
  running: "جاري (غير مفعّل)",
  ended: "منتهٍ",
  inactive: "غير نشط",
};

/**
 * حالة المعرض الزمنية + التشغيل — O(1) زمن ومكان.
 * active التشغيلي له أولوية العرض، مع وسم زمني إضافي عند الحاجة.
 */
export function exhibitionLifecycle(input: {
  active: boolean;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
  now?: Date;
}): ExhibitionLifecycle {
  const now = input.now ?? new Date();
  const starts = input.startsAt ? new Date(input.startsAt) : null;
  const ends = input.endsAt ? new Date(input.endsAt) : null;

  if (input.active) return "active";
  if (ends && !Number.isNaN(ends.getTime()) && ends.getTime() < now.getTime()) return "ended";
  if (starts && !Number.isNaN(starts.getTime()) && starts.getTime() > now.getTime()) return "upcoming";
  if (
    starts &&
    ends &&
    !Number.isNaN(starts.getTime()) &&
    !Number.isNaN(ends.getTime()) &&
    starts.getTime() <= now.getTime() &&
    ends.getTime() >= now.getTime()
  ) {
    return "running";
  }
  return "inactive";
}

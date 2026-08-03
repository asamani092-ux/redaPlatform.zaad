/**
 * الاستحقاق المحسوب — O(1) زمن ومكان.
 * الكامل = الأساسي + (عدد التابعين × استحقاق التابع)
 * الاستثناء (entitledOverride) يستبدل المحسوب إن وُجد.
 */
export function effectiveEntitlement(
  baseEntitlement: number,
  dependentsCount: number,
  dependentsEntitlement: number = 1,
  entitledOverride?: number | null,
): number {
  if (entitledOverride != null && Number.isFinite(entitledOverride)) {
    return entitledOverride;
  }
  const base = Number.isFinite(baseEntitlement) ? Math.max(0, Math.floor(baseEntitlement)) : 1;
  const deps = Number.isFinite(dependentsCount) ? Math.max(0, Math.floor(dependentsCount)) : 0;
  const perDep = Number.isFinite(dependentsEntitlement)
    ? Math.max(0, Math.floor(dependentsEntitlement))
    : 0;
  return base + deps * perDep;
}

/** قطع إضافية فوق الاستحقاق المحسوب — O(1) */
export function entitlementWithExtra(computed: number, extraAbove?: number | null): number {
  const base = Number.isFinite(computed) ? computed : 0;
  const extra =
    extraAbove != null && Number.isFinite(extraAbove) ? Math.max(0, Math.floor(extraAbove)) : 0;
  return base + extra;
}

export function isNonEmptyReason(reason: string | null | undefined): boolean {
  return !!reason && reason.trim().length > 0;
}

/**
 * الاستحقاق المحسوب — O(1) زمن ومكان.
 * computed = MAX(base, dependents) دون استثناء.
 */
export function effectiveEntitlement(
  baseEntitlement: number,
  dependentsCount: number,
  entitledOverride?: number | null,
): number {
  if (entitledOverride != null && Number.isFinite(entitledOverride)) {
    return entitledOverride;
  }
  const base = Number.isFinite(baseEntitlement) ? baseEntitlement : 1;
  const deps = Number.isFinite(dependentsCount) ? dependentsCount : 0;
  return Math.max(base, deps);
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

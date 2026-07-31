/**
 * الاستحقاق الفعلي — O(1) زمن ومكان.
 * effective = override إن وُجد، وإلا MAX(base, dependents).
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

export function isNonEmptyReason(reason: string | null | undefined): boolean {
  return !!reason && reason.trim().length > 0;
}

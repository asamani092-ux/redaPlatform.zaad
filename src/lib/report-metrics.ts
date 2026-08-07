/** مقاييس التقارير والعرض الحي — تجميع O(n) */

export type ShareRow = {
  key: string;
  count: number;
  percent: number;
};

export type TopDispensedItem = {
  inventoryItemId: string;
  quantity: number;
  attributes: Record<string, unknown>;
};

/** حجم الأسرة = المستفيد + التابعون */
export function householdSize(dependentsCount: number): number {
  return 1 + Math.max(0, dependentsCount);
}

export function groupCount(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((acc, v) => {
    acc[v] = (acc[v] ?? 0) + 1;
    return acc;
  }, {});
}

/** تحويل عدّاد إلى صفوف نسب — O(k) */
export function toShareRows(
  counts: Record<string, number>,
  total?: number,
): ShareRow[] {
  const sum = total ?? Object.values(counts).reduce((s, n) => s + n, 0);
  return Object.entries(counts)
    .map(([key, count]) => ({
      key,
      count,
      percent: sum > 0 ? Math.round((count / sum) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, "ar"));
}

export type HouseholdMetrics = {
  /** عدد الأسر = عدد سجلات المستفيدين (كل سجل = أسرة) */
  beneficiaryFamilies: number;
  /** إجمالي المستفيدين أفراداً = Σ(المستفيد + التابعون) */
  totalIndividuals: number;
  /** للتوافق الخلفي فقط — لا يُعرض في الواجهة */
  avgHouseholdSize: number;
  byHouseholdSize: ShareRow[];
};

/**
 * منطق الأسر: الأسرة = سجل مستفيد واحد؛ الأفراد = المستفيد + التابعون.
 * Time: O(n)؛ Space: O(k) لأحجام التوزيع.
 */
export function buildHouseholdMetrics(dependentsCounts: number[]): HouseholdMetrics {
  const sizes = dependentsCounts.map(householdSize);
  const beneficiaryFamilies = sizes.length;
  const totalIndividuals = sizes.reduce((s, v) => s + v, 0);
  const avgHouseholdSize =
    beneficiaryFamilies > 0
      ? Math.round((totalIndividuals / beneficiaryFamilies) * 10) / 10
      : 0;
  const byHouseholdSize = toShareRows(
    groupCount(sizes.map((v) => String(v))),
    beneficiaryFamilies,
  );
  return { beneficiaryFamilies, totalIndividuals, avgHouseholdSize, byHouseholdSize };
}

export type BreakdownShares = {
  byAssociation: ShareRow[];
  byNeighborhood: ShareRow[];
  byCity: ShareRow[];
  byGender: ShareRow[];
  households: HouseholdMetrics;
};

export function buildBreakdownShares(input: {
  associations: string[];
  neighborhoods: string[];
  cities: string[];
  genders: string[];
  dependentsCounts: number[];
}): BreakdownShares {
  const n = input.associations.length;
  return {
    byAssociation: toShareRows(
      groupCount(input.associations.map((v) => v || "غير محدد")),
      n,
    ),
    byNeighborhood: toShareRows(
      groupCount(input.neighborhoods.map((v) => v || "غير محدد")),
      n,
    ),
    byCity: toShareRows(groupCount(input.cities.map((v) => v || "غير محدد")), n),
    byGender: toShareRows(groupCount(input.genders.map((v) => v || "غير محدد")), n),
    households: buildHouseholdMetrics(input.dependentsCounts),
  };
}

/** توافق خلفي: Record من ShareRow[] */
export function sharesToRecord(rows: ShareRow[]): Record<string, number> {
  return Object.fromEntries(rows.map((r) => [r.key, r.count]));
}

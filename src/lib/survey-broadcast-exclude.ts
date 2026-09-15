export type BroadcastTarget = {
  id: string;
  name: string;
  mobile: string;
};

/** استخراج surveyId من payloadJson — Time O(1) Space O(1) */
export function surveyIdFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const raw = (payload as { surveyId?: unknown }).surveyId;
  if (typeof raw !== "string") return null;
  const id = raw.trim();
  return id || null;
}

/**
 * استبعاد من أُرسل لهم نفس الاستبيان (أو أي SURVEY إن لم يُمرَّر surveyId).
 * Time: O(n) — Space: O(n).
 */
export function excludePreviouslySentTargets<T extends { id: string }>(
  withMobile: T[],
  sentRows: Array<{ beneficiaryId: string | null; payloadJson: unknown }>,
  surveyId?: string | null,
): { remaining: T[]; alreadySent: number } {
  const want = surveyId?.trim() || null;
  const sentSet = new Set<string>();
  for (const row of sentRows) {
    const bid = row.beneficiaryId;
    if (!bid) continue;
    if (want) {
      if (surveyIdFromPayload(row.payloadJson) !== want) continue;
    }
    sentSet.add(bid);
  }
  const remaining = withMobile.filter((b) => !sentSet.has(b.id));
  return {
    remaining,
    alreadySent: withMobile.length - remaining.length,
  };
}

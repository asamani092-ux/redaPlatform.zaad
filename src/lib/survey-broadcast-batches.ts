/** حجم دفعة بث الاستبيان عبر واتساب */
export const SURVEY_BROADCAST_BATCH_SIZE = 200;

export type SurveyBroadcastBatch = {
  index: number;
  size: number;
};

/**
 * تقسيم العدد المتبقي إلى دفعات بحجم ثابت.
 * Time: O(n / batchSize) — Space: O(n / batchSize).
 */
export function buildSurveyBroadcastBatches(
  remainingCount: number,
  batchSize: number = SURVEY_BROADCAST_BATCH_SIZE,
): SurveyBroadcastBatch[] {
  const size = Math.max(1, Math.floor(batchSize));
  if (remainingCount <= 0) return [];
  const batches: SurveyBroadcastBatch[] = [];
  let left = remainingCount;
  let index = 0;
  while (left > 0) {
    const chunk = Math.min(size, left);
    batches.push({ index, size: chunk });
    left -= chunk;
    index += 1;
  }
  return batches;
}

/**
 * شريحة دفعة من قائمة مرتّبة.
 * Time: O(k) — Space: O(k).
 */
export function sliceSurveyBroadcastBatch<T>(
  items: T[],
  batchIndex: number,
  batchSize: number = SURVEY_BROADCAST_BATCH_SIZE,
): T[] {
  if (batchIndex < 0 || items.length === 0) return [];
  const start = batchIndex * batchSize;
  if (start >= items.length) return [];
  return items.slice(start, start + batchSize);
}

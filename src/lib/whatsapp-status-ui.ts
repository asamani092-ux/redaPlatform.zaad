/** نغمات شارة حالة واتساب للواجهة — O(1) */
export function chipToneForStatus(
  status: string | null,
): "success" | "warning" | "danger" | "neutral" {
  if (status === "SENT") return "success";
  if (status === "STUBBED" || status === "PENDING") return "warning";
  if (status === "FAILED") return "danger";
  return "neutral";
}

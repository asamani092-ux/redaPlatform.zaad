/** تصنيف سطر الصرف من سمات المخزون — ملابس / أقمشة / أخرى */

export type DispenseKind = "clothes" | "fabric" | "other";

/** استنتاج نوع الصرف من السمات — Time/Space: O(1) */
export function dispenseKind(attrs: Record<string, unknown>): DispenseKind {
  const type = String(attrs.type ?? "").trim();
  const unit = String(attrs.unit ?? "").trim();
  if (type.includes("ملابس") || unit === "قطعة") return "clothes";
  if (type.includes("قماش") || unit === "متر") return "fabric";
  return "other";
}

/** تجميع كميات الملابس والأقمشة من أسطر الصرف — Time: O(n)، Space: O(1) */
export function sumClothesAndFabric(
  lines: Array<{ quantity: number; attributes: Record<string, unknown> }>,
): { clothesPieces: number; fabricMeters: number } {
  let clothesPieces = 0;
  let fabricMeters = 0;
  for (const line of lines) {
    const qty = Number(line.quantity);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const kind = dispenseKind(line.attributes);
    if (kind === "fabric") fabricMeters += qty;
    else clothesPieces += qty;
  }
  return {
    clothesPieces: Math.round(clothesPieces * 1000) / 1000,
    fabricMeters: Math.round(fabricMeters * 1000) / 1000,
  };
}

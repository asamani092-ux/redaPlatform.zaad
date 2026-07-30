export type InventorySchemaField = {
  key: string;
  label: string;
  options: string[];
};

export const DEFAULT_INVENTORY_SCHEMA: InventorySchemaField[] = [
  { key: "type", label: "النوع", options: ["قماش", "ملابس"] },
  { key: "category", label: "الصنف", options: ["ثوب", "شال", "غطاء"] },
  { key: "color", label: "اللون", options: ["أحمر", "أزرق", "أخضر", "أسود"] },
  { key: "unit", label: "الوحدة", options: ["قطعة", "متر"] },
];

export function parseInventorySchema(raw: unknown): InventorySchemaField[] {
  if (!Array.isArray(raw)) return DEFAULT_INVENTORY_SCHEMA;
  const parsed = raw
    .map((item) => {
      const row = item as Record<string, unknown>;
      const key = String(row.key ?? "").trim();
      const label = String(row.label ?? key).trim();
      let options = Array.isArray(row.options)
        ? row.options.map((o) => String(o).trim()).filter(Boolean)
        : [];
      // ترحيل المخطط القديم {key,label,type} إلى خيارات افتراضية من DEFAULT إن وُجدت
      if (!options.length) {
        const fallback = DEFAULT_INVENTORY_SCHEMA.find((f) => f.key === key);
        options = fallback?.options?.length ? [...fallback.options] : ["—"];
      }
      return { key, label, options };
    })
    .filter((f) => f.key && f.label);
  return parsed.length ? parsed : DEFAULT_INVENTORY_SCHEMA;
}

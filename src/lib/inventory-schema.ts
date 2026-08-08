export type InventorySchemaField = {
  key: string;
  label: string;
  options: string[];
};

/** خيار تصنيف فارغ عند كفاية النوع/الصنف فقط */
export const INVENTORY_NONE_OPTION = "بدون";

/** سمات معتمدة لا تُحذف: اللون + الوحدة (أساس الكمية) */
export const REQUIRED_INVENTORY_ATTR_KEYS = ["color", "unit"] as const;

export const REQUIRED_INVENTORY_ATTR_LABELS: Record<string, string> = {
  color: "اللون",
  unit: "الوحدة",
};

/** خيارات السمة مع «بدون» في المقدمة — O(k) */
export function optionsWithNone(options: string[]): string[] {
  const rest = options.filter((o) => o !== INVENTORY_NONE_OPTION);
  return [INVENTORY_NONE_OPTION, ...rest];
}

export function isRequiredInventoryAttrKey(key: string): boolean {
  return (REQUIRED_INVENTORY_ATTR_KEYS as readonly string[]).includes(key);
}

export const DEFAULT_INVENTORY_SCHEMA: InventorySchemaField[] = [
  { key: "type", label: "النوع", options: [INVENTORY_NONE_OPTION, "قماش", "ملابس"] },
  { key: "category", label: "الصنف", options: [INVENTORY_NONE_OPTION, "ثوب", "شال", "غطاء"] },
  { key: "color", label: "اللون", options: [INVENTORY_NONE_OPTION, "أحمر", "أزرق", "أخضر", "أسود"] },
  { key: "unit", label: "الوحدة", options: ["قطعة", "متر"] },
];

/**
 * التحقق من تعديل المخطط — O(n).
 * يُسمح بحذف النوع/الصنف والسمات الإضافية؛ اللون والوحدة إلزاميان.
 * بعد إدخال أصناف: لا إضافة مفاتيح جديدة.
 */
export function validateInventorySchemaMutation(
  current: InventorySchemaField[],
  next: InventorySchemaField[],
  hasItems: boolean,
): string | null {
  if (!next.length) return "يجب الإبقاء على سمة واحدة على الأقل";
  const nextKeys = next.map((f) => f.key.trim()).filter(Boolean);
  if (new Set(nextKeys).size !== nextKeys.length) return "مفاتيح السمات مكررة";

  for (const req of REQUIRED_INVENTORY_ATTR_KEYS) {
    if (!nextKeys.includes(req)) {
      return `لا يمكن حذف السمة المعتمدة «${REQUIRED_INVENTORY_ATTR_LABELS[req]}»`;
    }
  }

  for (const f of next) {
    if (!f.label.trim()) return "تسمية السمة مطلوبة";
    if (!f.options.map((o) => o.trim()).filter(Boolean).length) {
      return `السمة «${f.label || f.key}» تحتاج خياراً واحداً على الأقل`;
    }
  }

  if (hasItems) {
    const currentKeys = new Set(current.map((f) => f.key));
    for (const k of nextKeys) {
      if (!currentKeys.has(k)) {
        return "لا يمكن إضافة سمات جديدة بعد إدخال أصناف — يمكن حذف النوع/الصنف أو تعديل الخيارات";
      }
    }
  }

  return null;
}

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

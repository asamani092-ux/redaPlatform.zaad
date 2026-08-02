import { DEFAULT_INVENTORY_SCHEMA, type InventorySchemaField } from "@/lib/inventory-schema";

const DEFAULT_LABELS: Record<string, string> = Object.fromEntries(
  DEFAULT_INVENTORY_SCHEMA.map((f) => [f.key, f.label]),
);

function labelsFromSchema(schema?: InventorySchemaField[] | null): Record<string, string> {
  if (!schema?.length) return DEFAULT_LABELS;
  const map: Record<string, string> = { ...DEFAULT_LABELS };
  for (const f of schema) {
    if (f.key) map[f.key] = f.label || f.key;
  }
  return map;
}

/**
 * عرض سمات الصنف بتسميات عربية كاملة دون اختصار المفتاح الإنجليزي — O(k) حيث k عدد السمات.
 */
export function AttrChips({
  attributes,
  schema,
  labels,
}: {
  attributes: Record<string, unknown> | null | undefined;
  schema?: InventorySchemaField[] | null;
  labels?: Record<string, string> | null;
}) {
  if (!attributes || typeof attributes !== "object") return <span>—</span>;
  const entries = Object.entries(attributes).filter(([, v]) => v != null && String(v).trim() !== "");
  if (!entries.length) return <span>—</span>;
  const labelMap = { ...labelsFromSchema(schema), ...(labels ?? {}) };
  return (
    <div className="attr-chips">
      {entries.map(([key, value]) => (
        <span key={key} className="attr-chip" title={`${labelMap[key] ?? key}: ${String(value)}`}>
          <b>{labelMap[key] ?? key}</b>
          <span>{String(value)}</span>
        </span>
      ))}
    </div>
  );
}

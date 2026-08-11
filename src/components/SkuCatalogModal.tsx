"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { AttrChips } from "@/components/AttrChips";
import type { InventorySchemaField } from "@/lib/inventory-schema";
import { buildPrintDocument, escapeHtml } from "@/lib/print-html";
import { useToast } from "@/components/ui/Toast";

export type SkuCatalogItem = {
  id: string;
  skuCode: string;
  attributes?: Record<string, unknown>;
  attributesJson?: Record<string, unknown>;
  quantity: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  items: SkuCatalogItem[];
  schema: InventorySchemaField[];
  onCopied?: (skuCode: string) => void;
};

/** نافذة قائمة الأصناف والرموز — بحث / نسخ / طباعة. Time: O(n) للفلترة. */
export function SkuCatalogModal({ open, onClose, items, schema, onCopied }: Props) {
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState("");
  const toast = useToast();

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((i) => {
      if (i.skuCode.includes(needle)) return true;
      const attrs = i.attributes ?? i.attributesJson ?? {};
      return Object.values(attrs).some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [items, q]);

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      onCopied?.(code);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      setCopied("");
      toast.push({ title: "تعذّر النسخ", tone: "warning" });
    }
  }

  function printTable() {
    const rows = filtered
      .map((i) => {
        const attrs = i.attributes ?? i.attributesJson ?? {};
        const label = schema
          .map((f) => String(attrs[f.key] ?? ""))
          .filter(Boolean)
          .join(" / ");
        return `<tr><td class="ltr">${escapeHtml(i.skuCode)}</td><td>${escapeHtml(label || "صنف")}</td><td>${escapeHtml(String(i.quantity))}</td></tr>`;
      })
      .join("");
    const html = buildPrintDocument({
      title: "قائمة الأصناف والرموز",
      subtitle: `${filtered.length} صنف`,
      sectionsHtml: `<h2>جدول الرموز</h2>
        <table><thead><tr><th>الرمز</th><th>الصنف</th><th>المتاح</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="3">لا أصناف</td></tr>`}</tbody></table>`,
    });
    // بدون noopener — وإلا يعيد Chromium null ويُفشل الطباعة بصمت
    const w = window.open("about:blank", "_blank", "width=900,height=700");
    if (!w) {
      toast.push({
        title: "تعذّرت الطباعة",
        body: "اسمح بالنوافذ المنبثقة ثم أعد المحاولة",
        tone: "warning",
      });
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  return (
    <Modal open={open} title="قائمة الأصناف والرموز" onClose={onClose} wide>
      <div className="toolbar toolbar--dense" style={{ marginBottom: "0.75rem" }}>
        <input
          className="input-field"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="بحث بالرمز أو اسم الصنف"
          dir="rtl"
        />
        <button type="button" className="btn-secondary btn-sm" onClick={printTable}>
          طباعة الجدول
        </button>
      </div>
      <div className="table-wrap table-wrap--stack">
        <table>
          <thead>
            <tr>
              <th>الرمز</th>
              <th>الصنف</th>
              <th>المتاح</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => (
              <tr key={i.id}>
                <td data-label="الرمز" dir="ltr">
                  {i.skuCode}
                </td>
                <td data-label="الصنف">
                  <AttrChips attributes={i.attributes ?? i.attributesJson} schema={schema} />
                </td>
                <td data-label="المتاح">{i.quantity}</td>
                <td data-label="">
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => void copyCode(i.skuCode)}
                  >
                    {copied === i.skuCode ? "تم" : "نسخ"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtered.length ? <p className="msg">لا نتائج</p> : null}
      <div className="form-actions" style={{ marginTop: "0.75rem" }}>
        <button type="button" className="btn-secondary" onClick={onClose}>
          العودة للصرف
        </button>
      </div>
    </Modal>
  );
}

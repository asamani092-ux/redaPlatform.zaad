"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { Chip } from "@/components/ui/Chip";
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

function itemSummary(
  item: SkuCatalogItem,
  schema: InventorySchemaField[],
): string {
  const attrs = item.attributes ?? item.attributesJson ?? {};
  const parts = schema
    .map((f) => String(attrs[f.key] ?? "").trim())
    .filter(Boolean);
  return parts.length ? parts.join(" · ") : "صنف";
}

/** طباعة HTML عبر iframe مخفي — يعمل حتى مع حظر النوافذ المنبثقة. Time: O(n) */
function printHtmlDocument(html: string): boolean {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("title", "طباعة");
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
    opacity: "0",
    pointerEvents: "none",
  });
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    return false;
  }
  doc.open();
  doc.write(html.replace(
    /<script>window\.onload = \(\) => window\.print\(\);<\/script>/,
    "",
  ));
  doc.close();

  const runPrint = () => {
    try {
      win.focus();
      win.print();
    } finally {
      window.setTimeout(() => iframe.remove(), 1500);
    }
  };

  if (doc.readyState === "complete") {
    window.setTimeout(runPrint, 50);
  } else {
    iframe.onload = () => window.setTimeout(runPrint, 50);
  }
  return true;
}

/** نافذة قائمة الأصناف والرموز — جدول / نسخ بالضغط على الرمز / طباعة. Time: O(n). */
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
      toast.push({ title: `تم نسخ الرمز ${code}`, tone: "success" });
      window.setTimeout(() => {
        setCopied((c) => (c === code ? "" : c));
        onCopied?.(code);
      }, 350);
    } catch {
      setCopied("");
      toast.push({ title: "تعذّر النسخ", tone: "warning" });
    }
  }

  function printTable() {
    const rows = filtered
      .map((i) => {
        const label = itemSummary(i, schema);
        return `<tr><td class="ltr">${escapeHtml(i.skuCode)}</td><td>${escapeHtml(label)}</td><td>${escapeHtml(String(i.quantity))}</td></tr>`;
      })
      .join("");
    const html = buildPrintDocument({
      title: "قائمة الأصناف والرموز",
      subtitle: `${filtered.length} صنف`,
      sectionsHtml: `<h2>جدول الرموز</h2>
        <table><thead><tr><th>الرمز</th><th>الصنف</th><th>المتاح</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="3">لا أصناف</td></tr>`}</tbody></table>`,
    });

    if (printHtmlDocument(html)) {
      toast.push({ title: "جاري فتح الطباعة", tone: "success" });
      return;
    }

    // احتياطي: نافذة منبثقة إن فشل iframe
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
      <div className="table-wrap zad-table-wrap">
        <table>
          <thead>
            <tr>
              <th>الرمز</th>
              <th>الصنف</th>
              <th>المتاح</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => (
              <tr key={i.id}>
                <td data-label="الرمز">
                  <div className="sku-code-cell">
                    <button
                      type="button"
                      className={`sku-code-cell__btn${copied === i.skuCode ? " is-copied" : ""}`}
                      dir="ltr"
                      aria-label={`نسخ الرمز ${i.skuCode}`}
                      title="اضغط لنسخ الرمز"
                      onClick={() => void copyCode(i.skuCode)}
                    >
                      <Chip
                        tone={copied === i.skuCode ? "success" : "neutral"}
                        label={copied === i.skuCode ? "تم النسخ" : i.skuCode}
                      />
                    </button>
                  </div>
                </td>
                <td data-label="الصنف">
                  <span className="inventory-table__summary">{itemSummary(i, schema)}</span>
                </td>
                <td data-label="المتاح">
                  <Chip tone="brand" label={String(i.quantity)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtered.length ? <p className="msg">لا نتائج</p> : null}
      <div className="form-actions" style={{ marginTop: "0.75rem" }}>
        <button type="button" className="btn-secondary btn-sm" onClick={onClose}>
          العودة للصرف
        </button>
      </div>
    </Modal>
  );
}

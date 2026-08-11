"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { AttrChips } from "@/components/AttrChips";
import { Modal } from "@/components/Modal";
import {
  optionsWithNone,
  type InventorySchemaField,
} from "@/lib/inventory-schema";
import { sanitizeNumericInput, toNumberOrNull } from "@/lib/num";
import { PaginationBar } from "@/components/PaginationBar";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { useToast } from "@/components/ui/Toast";
import { DataTable } from "@/components/ui/DataTable";
import { Chip } from "@/components/ui/Chip";

type Item = {
  id: string;
  skuCode?: string;
  attributes: Record<string, unknown>;
  quantity: number;
  lowStock: boolean;
};

/**
 * المخزون: إضافة / تعديل سمات الصنف / حركة كمية.
 * Time: O(n) لعرض القائمة، O(s) لحفظ السمات.
 */
export default function InventoryPage() {
  const [schema, setSchema] = useState<InventorySchemaField[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [msg, setMsg] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attrs, setAttrs] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState("0");
  const [move, setMove] = useState({ inventoryItemId: "", type: "ADD", quantity: "1", note: "" });
  const [copiedSku, setCopiedSku] = useState("");
  const [detailItem, setDetailItem] = useState<Item | null>(null);
  const toast = useToast();

  async function copySku(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedSku(code);
      toast.push({ title: `تم نسخ الرمز ${code}`, tone: "success" });
      window.setTimeout(() => setCopiedSku((c) => (c === code ? "" : c)), 1400);
    } catch {
      toast.push({ title: "تعذّر النسخ", tone: "warning" });
    }
  }

  function itemSummary(item: Item): string {
    const parts = schema
      .map((f) => String(item.attributes[f.key] ?? "").trim())
      .filter(Boolean);
    return parts.length ? parts.join(" · ") : "صنف";
  }

  async function load(p = page) {
    const res = await fetch(`/api/inventory?page=${p}&pageSize=${DEFAULT_PAGE_SIZE}`);
    const json = await res.json();
    if (res.ok) {
      setSchema(json.schema ?? []);
      setItems(json.data ?? []);
      setPage(json.page ?? p);
      setTotalPages(json.totalPages ?? 1);
      setTotal(json.total ?? 0);
    } else setMsg(json.error || "تعذر التحميل");
  }

  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const defaultAttrs = useMemo(() => {
    const next: Record<string, string> = {};
    for (const f of schema) next[f.key] = f.options[0] ?? "";
    return next;
  }, [schema]);

  function attrsFromItem(item: Item): Record<string, string> {
    const next: Record<string, string> = {};
    for (const f of schema) {
      const raw = item.attributes?.[f.key];
      const asStr = raw != null ? String(raw) : "";
      const opts = optionsWithNone(f.options);
      next[f.key] = opts.includes(asStr) ? asStr : (opts[0] ?? "");
    }
    return next;
  }

  function openAdd() {
    setAttrs({ ...defaultAttrs });
    setQuantity("0");
    setMsg("");
    setAddOpen(true);
  }

  function openEdit(item: Item) {
    setEditingId(item.id);
    setAttrs(attrsFromItem(item));
    setMsg("");
    setEditOpen(true);
  }

  function openMove(itemId?: string) {
    setMove({
      inventoryItemId: itemId ?? items[0]?.id ?? "",
      type: "ADD",
      quantity: "1",
      note: "",
    });
    setMsg("");
    setMoveOpen(true);
  }

  const moveIsRemove = move.type === "REMOVE";
  const moveIsReturn = move.type === "RETURN";

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attributes: attrs, quantity: toNumberOrNull(quantity) ?? 0 }),
    });
    const json = await res.json();
    setBusy(false);
    setMsg(res.ok ? "تمت إضافة الصنف" : json.error || "فشل الإضافة");
    toast.push({
      title: res.ok ? "تمت إضافة الصنف" : json.error || "فشل الإضافة",
      tone: res.ok ? "success" : "danger",
    });
    if (res.ok) {
      setAddOpen(false);
      await load();
    }
  }

  async function onEdit(e: FormEvent) {
    e.preventDefault();
    if (busy || !editingId) return;
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/inventory", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingId, attributes: attrs }),
    });
    const json = await res.json();
    setBusy(false);
    setMsg(res.ok ? "تم تعديل الصنف" : json.error || "فشل التعديل");
    toast.push({
      title: res.ok ? "تم تعديل الصنف" : json.error || "فشل التعديل",
      tone: res.ok ? "success" : "danger",
    });
    if (res.ok) {
      setEditOpen(false);
      setEditingId(null);
      await load();
    }
  }

  async function onMove(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const qty = toNumberOrNull(move.quantity);
    if (qty == null || qty <= 0) {
      setMsg("أدخل كمية صحيحة أكبر من صفر");
      return;
    }
    if (move.type === "REMOVE" && !move.note.trim()) {
      setMsg("سبب الحذف مطلوب");
      return;
    }
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inventoryItemId: move.inventoryItemId,
        type: move.type,
        quantity: qty,
        note: move.note.trim() || undefined,
      }),
    });
    const json = await res.json();
    setBusy(false);
    const moveOk = res.ok
      ? move.type === "REMOVE"
        ? "تم حذف الكمية من المخزون"
        : move.type === "RETURN"
          ? "تم استرجاع الكمية إلى المخزون"
          : "تم تحديث الكمية"
      : json.error || "فشل التحديث";
    setMsg(moveOk);
    toast.push({ title: moveOk, tone: res.ok ? "success" : "danger" });
    if (res.ok) {
      setMoveOpen(false);
      await load();
    }
  }

  function attrFields() {
    return schema.map((f) => {
      const opts = optionsWithNone(f.options);
      return (
        <div key={f.key}>
          <label className="label-field">{f.label}</label>
          <select
            className="input-field"
            value={attrs[f.key] ?? ""}
            onChange={(e) => setAttrs((a) => ({ ...a, [f.key]: e.target.value }))}
            required
          >
            {opts.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      );
    });
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="المخزون"
        description="إضافة الأصناف وتعديل سماتها وحركات الكمية أثناء التشغيل"
        breadcrumb={[{ label: "الرئيسية", href: "/dashboard" }, { label: "المخزون" }]}
        actions={
          <>
            <button type="button" className="btn-primary btn-sm" onClick={openAdd}>
              إضافة صنف
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => openMove()}
              disabled={!items.length}
            >
              حركة كمية
            </button>
          </>
        }
      />
      {msg ? <p className="msg">{msg}</p> : null}

      <section className="panel">
        <h2 className="panel-title">الأصناف الحالية ({total})</h2>
        <p className="page-header__desc">اضغط الصف لعرض التفاصيل</p>
        <DataTable
          stack={false}
          empty={!items.length}
          emptyTitle="لا أصناف بعد"
          emptyBody="أضف صنفاً جديداً لبدء تتبع المخزون."
        >
          <table>
            <thead>
              <tr>
                <th scope="col">الرمز</th>
                <th scope="col">الصنف</th>
                <th scope="col">الكمية</th>
                <th scope="col">تنبيه</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr
                  key={i.id}
                  className="inventory-table__row"
                  tabIndex={0}
                  role="button"
                  onClick={() => setDetailItem(i)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setDetailItem(i);
                    }
                  }}
                >
                  <td data-label="الرمز">
                    <div className="sku-code-cell">
                      {i.skuCode ? (
                        <button
                          type="button"
                          className={`sku-code-cell__btn${copiedSku === i.skuCode ? " is-copied" : ""}`}
                          dir="ltr"
                          aria-label={`نسخ الرمز ${i.skuCode}`}
                          title="اضغط لنسخ الرمز"
                          onClick={(e) => {
                            e.stopPropagation();
                            void copySku(i.skuCode!);
                          }}
                        >
                          <Chip
                            tone={copiedSku === i.skuCode ? "success" : "neutral"}
                            label={copiedSku === i.skuCode ? "تم النسخ" : i.skuCode}
                          />
                        </button>
                      ) : (
                        <Chip tone="neutral" label="—" />
                      )}
                    </div>
                  </td>
                  <td data-label="الصنف">
                    <span className="inventory-table__summary">{itemSummary(i)}</span>
                  </td>
                  <td data-label="الكمية">
                    <Chip tone="brand" label={String(i.quantity)} />
                  </td>
                  <td data-label="تنبيه">
                    <Chip
                      tone={i.lowStock ? "warning" : "success"}
                      label={i.lowStock ? "قرب النفاد" : "متوفر"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
        <PaginationBar
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={DEFAULT_PAGE_SIZE}
          busy={busy}
          onPageChange={(p) => void load(p)}
        />
      </section>

      <Modal
        open={Boolean(detailItem)}
        title={detailItem ? `تفاصيل الصنف ${detailItem.skuCode ?? ""}` : "تفاصيل الصنف"}
        onClose={() => setDetailItem(null)}
        wide
      >
        {detailItem ? (
          <>
            <div className="sku-code-cell" style={{ marginBottom: "0.75rem" }}>
              {detailItem.skuCode ? (
                <button
                  type="button"
                  className={`sku-code-cell__btn${copiedSku === detailItem.skuCode ? " is-copied" : ""}`}
                  dir="ltr"
                  aria-label={`نسخ الرمز ${detailItem.skuCode}`}
                  title="اضغط لنسخ الرمز"
                  onClick={() => void copySku(detailItem.skuCode!)}
                >
                  <Chip
                    tone={copiedSku === detailItem.skuCode ? "success" : "neutral"}
                    label={copiedSku === detailItem.skuCode ? "تم النسخ" : detailItem.skuCode}
                  />
                </button>
              ) : null}
              <Chip tone="brand" label={`الكمية ${detailItem.quantity}`} />
              <Chip
                tone={detailItem.lowStock ? "warning" : "success"}
                label={detailItem.lowStock ? "قرب النفاد" : "متوفر"}
              />
            </div>
            <h3 className="panel-title">السمات</h3>
            <AttrChips attributes={detailItem.attributes} schema={schema} />
            <div className="form-actions" style={{ marginTop: "1rem" }}>
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={() => {
                  const item = detailItem;
                  setDetailItem(null);
                  openEdit(item);
                }}
              >
                تعديل
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => {
                  const id = detailItem.id;
                  setDetailItem(null);
                  openMove(id);
                }}
              >
                حركة كمية
              </button>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setDetailItem(null)}>
                إغلاق
              </button>
            </div>
          </>
        ) : null}
      </Modal>

      <Modal open={addOpen} title="إضافة صنف" onClose={() => !busy && setAddOpen(false)} wide>
        <form onSubmit={onCreate}>
          <div className="form-grid">
            {attrFields()}
            <div>
              <label className="label-field">الكمية</label>
              <input
                className="input-field"
                type="text"
                inputMode="decimal"
                required
                dir="ltr"
                value={quantity}
                onChange={(e) => setQuantity(sanitizeNumericInput(e.target.value))}
              />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? "جاري الحفظ…" : "حفظ"}
            </button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => setAddOpen(false)}>
              إلغاء
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={editOpen}
        title="تعديل الصنف"
        onClose={() => {
          if (busy) return;
          setEditOpen(false);
          setEditingId(null);
        }}
        wide
      >
        <form onSubmit={onEdit}>
          <p className="page-header__desc" style={{ marginBottom: "0.75rem" }}>
            تعديل السمات فقط — لتغيير الكمية استخدم «حركة كمية».
          </p>
          <div className="form-grid">{attrFields()}</div>
          <div className="form-actions">
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? "جاري الحفظ…" : "حفظ التعديل"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => {
                setEditOpen(false);
                setEditingId(null);
              }}
            >
              إلغاء
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={moveOpen} title="حركة كمية" onClose={() => !busy && setMoveOpen(false)}>
        <form onSubmit={onMove}>
          <div className="form-grid">
            <div className="full">
              <label className="label-field">الصنف</label>
              <select
                className="input-field"
                value={move.inventoryItemId}
                onChange={(e) => setMove((m) => ({ ...m, inventoryItemId: e.target.value }))}
                required
              >
                <option value="">—</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {Object.values(i.attributes).join(" / ")} — {i.quantity}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">نوع الحركة</label>
              <select
                className="input-field"
                value={move.type}
                onChange={(e) => setMove((m) => ({ ...m, type: e.target.value }))}
              >
                <option value="ADD">إضافة</option>
                <option value="RETURN">استرجاع</option>
                <option value="REMOVE">حذف</option>
              </select>
            </div>
            <div>
              <label className="label-field">الكمية</label>
              <input
                className="input-field"
                dir="ltr"
                type="text"
                inputMode="decimal"
                value={move.quantity}
                onChange={(e) =>
                  setMove((m) => ({ ...m, quantity: sanitizeNumericInput(e.target.value) }))
                }
                required
              />
            </div>
            <div className="full">
              <label className="label-field">
                {moveIsRemove ? "سبب الحذف (إلزامي)" : "ملاحظة (اختياري)"}
              </label>
              <input
                className="input-field"
                value={move.note}
                onChange={(e) => setMove((m) => ({ ...m, note: e.target.value }))}
                required={moveIsRemove}
                placeholder={
                  moveIsRemove
                    ? "مثال: تالف / خطأ إدخال / منتهي الصلاحية"
                    : moveIsReturn
                      ? "مثال: إرجاع من مستفيد / تصحيح صرف"
                      : ""
                }
              />
            </div>
          </div>
          <div className="form-actions">
            <button
              className={moveIsRemove ? "btn-danger" : "btn-primary"}
              type="submit"
              disabled={busy || (moveIsRemove && !move.note.trim())}
            >
              {busy
                ? "جاري التنفيذ…"
                : moveIsRemove
                  ? "تأكيد الحذف"
                  : moveIsReturn
                    ? "تنفيذ الاسترجاع"
                    : "تنفيذ الإضافة"}
            </button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => setMoveOpen(false)}>
              إلغاء
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

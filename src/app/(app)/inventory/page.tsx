"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { AttrChips } from "@/components/AttrChips";
import { Modal } from "@/components/Modal";
import type { InventorySchemaField } from "@/lib/inventory-schema";
import { sanitizeNumericInput, toNumberOrNull } from "@/lib/num";
import { PaginationBar } from "@/components/PaginationBar";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { useToast } from "@/components/ui/Toast";
import { DataTable } from "@/components/ui/DataTable";
import { Chip } from "@/components/ui/Chip";

type Item = {
  id: string;
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
  const toast = useToast();

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
      next[f.key] = f.options.includes(asStr) ? asStr : (f.options[0] ?? "");
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
    return schema.map((f) => (
      <div key={f.key}>
        <label className="label-field">{f.label}</label>
        <select
          className="input-field"
          value={attrs[f.key] ?? ""}
          onChange={(e) => setAttrs((a) => ({ ...a, [f.key]: e.target.value }))}
          required
        >
          {f.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    ));
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="المخزون"
        description="إضافة الأصناف وتعديل سماتها وحركات الكمية أثناء التشغيل"
        breadcrumb={[{ label: "الرئيسية", href: "/dashboard" }, { label: "المخزون" }]}
        actions={
          <>
            <button type="button" className="btn-primary" onClick={openAdd}>
              إضافة صنف
            </button>
            <button
              type="button"
              className="btn-secondary"
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
        <DataTable
          empty={!items.length}
          emptyTitle="لا أصناف بعد"
          emptyBody="أضف صنفاً جديداً لبدء تتبع المخزون."
        >
          <table>
            <thead>
              <tr>
                <th scope="col">السمات</th>
                <th scope="col">الكمية</th>
                <th scope="col">تنبيه</th>
                <th scope="col">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td>
                    <AttrChips attributes={i.attributes} schema={schema} />
                  </td>
                  <td>{i.quantity}</td>
                  <td>
                    <Chip
                      tone={i.lowStock ? "warning" : "success"}
                      label={i.lowStock ? "قرب النفاد" : "متوفر"}
                    />
                  </td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="btn-secondary btn-sm" onClick={() => openEdit(i)}>
                        تعديل
                      </button>
                      <button type="button" className="btn-secondary btn-sm" onClick={() => openMove(i.id)}>
                        حركة
                      </button>
                    </div>
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
                placeholder={moveIsRemove ? "مثال: تالف / خطأ إدخال / منتهي الصلاحية" : ""}
              />
            </div>
          </div>
          <div className="form-actions">
            <button
              className={moveIsRemove ? "btn-danger" : "btn-primary"}
              type="submit"
              disabled={busy || (moveIsRemove && !move.note.trim())}
            >
              {busy ? "جاري التنفيذ…" : moveIsRemove ? "تأكيد الحذف" : "تنفيذ الإضافة"}
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

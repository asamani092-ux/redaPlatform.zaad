"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { AttrChips } from "@/components/AttrChips";
import { Modal } from "@/components/Modal";
import type { InventorySchemaField } from "@/lib/inventory-schema";

type Item = {
  id: string;
  attributes: Record<string, unknown>;
  quantity: number;
  lowStock: boolean;
};

export default function InventoryPage() {
  const [schema, setSchema] = useState<InventorySchemaField[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [msg, setMsg] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attrs, setAttrs] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState("0");
  const [move, setMove] = useState({ inventoryItemId: "", type: "ADD", quantity: "1", note: "" });

  async function load() {
    const res = await fetch("/api/inventory");
    const json = await res.json();
    if (res.ok) {
      setSchema(json.schema ?? []);
      setItems(json.data ?? []);
    } else setMsg(json.error || "تعذر التحميل");
  }

  useEffect(() => {
    void load();
  }, []);

  const defaultAttrs = useMemo(() => {
    const next: Record<string, string> = {};
    for (const f of schema) next[f.key] = f.options[0] ?? "";
    return next;
  }, [schema]);

  function openAdd() {
    setAttrs({ ...defaultAttrs });
    setQuantity("0");
    setMsg("");
    setAddOpen(true);
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

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attributes: attrs, quantity: Number(quantity || 0) }),
    });
    const json = await res.json();
    setBusy(false);
    setMsg(res.ok ? "تمت إضافة الصنف" : json.error || "فشل الإضافة");
    if (res.ok) {
      setAddOpen(false);
      await load();
    }
  }

  async function onMove(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inventoryItemId: move.inventoryItemId,
        type: move.type,
        quantity: Number(move.quantity),
        note: move.note || undefined,
      }),
    });
    const json = await res.json();
    setBusy(false);
    setMsg(res.ok ? "تم تحديث الكمية" : json.error || "فشل التحديث");
    if (res.ok) {
      setMoveOpen(false);
      await load();
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="المخزون"
        description="إدخال الأصناف وتعديل الكميات فقط أثناء التشغيل"
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
        <h2 className="panel-title">الأصناف الحالية</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>السمات</th>
                <th>الكمية</th>
                <th>تنبيه</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td>
                    <AttrChips attributes={i.attributes} />
                  </td>
                  <td>{i.quantity}</td>
                  <td>
                    <span className={`badge ${i.lowStock ? "badge-warning" : "badge-success"}`}>
                      {i.lowStock ? "قرب النفاد" : "متوفر"}
                    </span>
                  </td>
                  <td>
                    <button type="button" className="btn-secondary" onClick={() => openMove(i.id)}>
                      حركة
                    </button>
                  </td>
                </tr>
              ))}
              {!items.length ? (
                <tr>
                  <td colSpan={4} className="empty">
                    لا أصناف بعد
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <Modal open={addOpen} title="إضافة صنف" onClose={() => !busy && setAddOpen(false)} wide>
        <form onSubmit={onCreate}>
          <div className="form-grid">
            {schema.map((f) => (
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
            ))}
            <div>
              <label className="label-field">الكمية</label>
              <input
                className="input-field"
                type="number"
                min={0}
                step="0.001"
                required
                dir="ltr"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
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
              <label className="label-field">النوع</label>
              <select
                className="input-field"
                value={move.type}
                onChange={(e) => setMove((m) => ({ ...m, type: e.target.value }))}
              >
                <option value="ADD">إضافة</option>
                <option value="RETURN">استرجاع</option>
              </select>
            </div>
            <div>
              <label className="label-field">الكمية</label>
              <input
                className="input-field"
                dir="ltr"
                type="number"
                min={0.001}
                step="0.001"
                value={move.quantity}
                onChange={(e) => setMove((m) => ({ ...m, quantity: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label-field">ملاحظة</label>
              <input
                className="input-field"
                value={move.note}
                onChange={(e) => setMove((m) => ({ ...m, note: e.target.value }))}
              />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? "جاري التنفيذ…" : "تنفيذ"}
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

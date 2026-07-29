"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { AttrChips } from "@/components/AttrChips";

type SchemaField = { key: string; label: string; type: string };
type Item = {
  id: string;
  attributes: Record<string, unknown>;
  quantity: number;
  lowStock: boolean;
};

export default function InventoryPage() {
  const [schema, setSchema] = useState<SchemaField[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [msg, setMsg] = useState("");
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
    load();
  }, []);

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const attributes: Record<string, string | number> = {};
    for (const field of schema) {
      const v = String(fd.get(field.key) ?? "");
      attributes[field.key] = field.type === "number" ? Number(v) : v;
    }
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attributes, quantity: Number(fd.get("quantity") || 0) }),
    });
    const json = await res.json();
    setMsg(res.ok ? "تمت إضافة الصنف" : json.error);
    if (res.ok) {
      e.currentTarget.reset();
      load();
    }
  }

  async function onMove(e: FormEvent) {
    e.preventDefault();
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
    setMsg(res.ok ? "تم تحديث الكمية" : json.error);
    if (res.ok) load();
  }

  return (
    <div className="page-stack">
      <PageHeader title="المخزون" description="إدخال الأصناف وتعديل الكميات فقط أثناء التشغيل" />
      {msg ? <p className="msg">{msg}</p> : null}

      <section className="panel">
        <h2 className="panel-title">إدخال صنف</h2>
        <form onSubmit={onCreate}>
          <div className="form-grid">
            {schema.map((f) => (
              <div key={f.key}>
                <label className="label-field">{f.label}</label>
                <input name={f.key} className="input-field" required type={f.type === "number" ? "number" : "text"} />
              </div>
            ))}
            <div>
              <label className="label-field">الكمية</label>
              <input name="quantity" className="input-field" type="number" min={0} step="0.001" required dir="ltr" />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-primary" type="submit">
              إدخال صنف
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2 className="panel-title">إضافة / استرجاع كمية</h2>
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
                    {Object.values(i.attributes).join(" / ")}
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
              />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-secondary" type="submit">
              تنفيذ الحركة
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2 className="panel-title">الأصناف الحالية</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>السمات</th>
                <th>الكمية</th>
                <th>تنبيه</th>
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
                </tr>
              ))}
              {!items.length ? (
                <tr>
                  <td colSpan={3} className="empty">
                    لا أصناف بعد
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

"use client";

import { FormEvent, useEffect, useState } from "react";

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
    <div className="space-y-4">
      <div className="panel">
        <h1 className="text-2xl font-extrabold text-primary mb-3">المخزون</h1>
        {msg ? <p className="mb-3 font-semibold text-primary">{msg}</p> : null}
        <form onSubmit={onCreate} className="grid md:grid-cols-2 gap-3">
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
          <div className="md:col-span-2">
            <button className="btn-primary" type="submit">
              إدخال صنف
            </button>
          </div>
        </form>
      </div>

      <div className="panel">
        <h2 className="font-bold text-primary mb-3">إضافة / استرجاع كمية</h2>
        <form onSubmit={onMove} className="grid md:grid-cols-4 gap-3 items-end">
          <div>
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
                  {JSON.stringify(i.attributes)}
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
          <div>
            <button className="btn-secondary w-full" type="submit">
              تنفيذ
            </button>
          </div>
        </form>
      </div>

      <div className="panel">
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
                  <td>{JSON.stringify(i.attributes)}</td>
                  <td>{i.quantity}</td>
                  <td>
                    <span className={`badge ${i.lowStock ? "badge-warning" : "badge-success"}`}>
                      {i.lowStock ? "قرب النفاد" : "متوفر"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

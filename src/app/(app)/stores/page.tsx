"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { AttrChips } from "@/components/AttrChips";
import { Modal } from "@/components/Modal";
import { optionsWithNone, type InventorySchemaField } from "@/lib/inventory-schema";
import { sanitizeNumericInput, toNumberOrNull } from "@/lib/num";
import { useToast } from "@/components/ui/Toast";
import { DataTable } from "@/components/ui/DataTable";
import { useSession } from "next-auth/react";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";

type StoreRow = {
  id: string;
  name: string;
  active: boolean;
  notes: string | null;
};

type SummaryRow = {
  storeId: string;
  storeName: string;
  inventoryItemId: string;
  skuCode: string;
  attributes: Record<string, unknown>;
  added: number;
  dispensed: number;
  returned: number;
  removed: number;
  remaining: number;
};

type InvItem = {
  id: string;
  skuCode: string;
  attributes: Record<string, unknown>;
  quantity: number;
};

/**
 * تبويب المتاجر: تسجيل متاجر + مساهمات تدخل المخزون الموحّد + حصر.
 * Time: O(n) للعرض.
 */
export default function StoresPage() {
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const canManage = role ? hasPermission(role, "stores:manage") : false;
  const toast = useToast();

  const [stores, setStores] = useState<StoreRow[]>([]);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [schema, setSchema] = useState<InventorySchemaField[]>([]);
  const [inventory, setInventory] = useState<InvItem[]>([]);
  const [day, setDay] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [contribOpen, setContribOpen] = useState(false);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [storeId, setStoreId] = useState("");
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [inventoryItemId, setInventoryItemId] = useState("");
  const [qty, setQty] = useState("1");
  const [attrs, setAttrs] = useState<Record<string, string>>({});

  async function load() {
    const qs = day ? `?day=${encodeURIComponent(day)}` : "";
    const [storesRes, invRes] = await Promise.all([
      fetch(`/api/stores${qs}`),
      fetch("/api/inventory?page=1&pageSize=200"),
    ]);
    const sj = await storesRes.json();
    const ij = await invRes.json();
    if (storesRes.ok) {
      setStores(sj.stores ?? []);
      setSummary(sj.summary ?? []);
      setSchema(sj.schema ?? []);
    } else setMsg(sj.error || "تعذر تحميل المتاجر");
    if (invRes.ok) {
      setInventory(
        (ij.data ?? []).map((i: InvItem & { attributesJson?: Record<string, unknown> }) => ({
          id: i.id,
          skuCode: i.skuCode,
          attributes: i.attributes ?? i.attributesJson ?? {},
          quantity: Number(i.quantity),
        })),
      );
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const defaultAttrs = useMemo(() => {
    const next: Record<string, string> = {};
    for (const f of schema) next[f.key] = f.options[0] ?? "";
    return next;
  }, [schema]);

  async function onCreateStore(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setBusy(true);
    const res = await fetch("/api/stores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, notes }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(json.error || "فشل إنشاء المتجر");
      return;
    }
    toast.push({ title: "تم إضافة المتجر", tone: "success" });
    setAddOpen(false);
    setName("");
    setNotes("");
    void load();
  }

  async function onContribute(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    const quantity = toNumberOrNull(qty);
    if (quantity == null || quantity <= 0) {
      setMsg("أدخل كمية موجبة");
      return;
    }
    setBusy(true);
    const body =
      mode === "existing"
        ? { action: "contribute", storeId, inventoryItemId, quantity }
        : { action: "contribute", storeId, attributes: attrs, quantity };
    const res = await fetch("/api/stores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(json.error || "فشل تسجيل المساهمة");
      return;
    }
    toast.push({ title: "سُجّلت المساهمة في المخزون", tone: "success" });
    setContribOpen(false);
    setQty("1");
    void load();
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="المتاجر"
        description="متاجر مشاركة تساهم بمنتجات تدخل المخزون الموحّد — حصر المضاف والمصروف والمتبقي"
        breadcrumb={[{ label: "الرئيسية", href: "/dashboard" }, { label: "المتاجر" }]}
        actions={
          canManage ? (
            <>
              <button type="button" className="btn-primary" onClick={() => setAddOpen(true)}>
                إضافة متجر
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setStoreId(stores[0]?.id ?? "");
                  setMode("existing");
                  setInventoryItemId(inventory[0]?.id ?? "");
                  setAttrs({ ...defaultAttrs });
                  setContribOpen(true);
                }}
                disabled={!stores.length}
              >
                تسجيل مساهمة
              </button>
            </>
          ) : null
        }
      />
      {msg ? <p className="msg">{msg}</p> : null}

      <section className="panel">
        <div className="toolbar">
          <label className="label-field" htmlFor="store-day">
            تصفية يوم الحركات (اختياري)
          </label>
          <input
            id="store-day"
            type="date"
            className="input-field"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
          <button type="button" className="btn-secondary" onClick={() => void load()}>
            تطبيق
          </button>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">المتاجر ({stores.length})</h2>
        <DataTable empty={!stores.length} emptyTitle="لا متاجر بعد" emptyBody="أضف متجراً مشاركاً.">
          <table>
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الحالة</th>
                <th>ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((s) => (
                <tr key={s.id}>
                  <td data-label="الاسم">{s.name}</td>
                  <td data-label="الحالة">{s.active ? "نشط" : "متوقف"}</td>
                  <td data-label="ملاحظات">{s.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      </section>

      <section className="panel">
        <h2 className="panel-title">حصر المساهمات</h2>
        <DataTable
          empty={!summary.length}
          emptyTitle="لا حركات متاجر بعد"
          emptyBody="سجّل مساهمة لتظهر في الحصر والتقارير."
        >
          <table>
            <thead>
              <tr>
                <th>المتجر</th>
                <th>الرمز</th>
                <th>الصنف</th>
                <th>مضاف</th>
                <th>مصروف</th>
                <th>مرتجع</th>
                <th>متبقي</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((r) => (
                <tr key={`${r.storeId}:${r.inventoryItemId}`}>
                  <td data-label="المتجر">{r.storeName}</td>
                  <td data-label="الرمز" dir="ltr">
                    {r.skuCode}
                  </td>
                  <td data-label="الصنف">
                    <AttrChips attributes={r.attributes} schema={schema} />
                  </td>
                  <td data-label="مضاف">{r.added}</td>
                  <td data-label="مصروف">{r.dispensed}</td>
                  <td data-label="مرتجع">{r.returned}</td>
                  <td data-label="متبقي">{r.remaining}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      </section>

      <Modal open={addOpen} title="إضافة متجر" onClose={() => !busy && setAddOpen(false)}>
        <form onSubmit={onCreateStore}>
          <div className="form-grid">
            <div>
              <label className="label-field">اسم المتجر</label>
              <input className="input-field" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="full">
              <label className="label-field">ملاحظات</label>
              <input className="input-field" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-primary" type="submit" disabled={busy}>
              حفظ
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={contribOpen} title="تسجيل مساهمة" onClose={() => !busy && setContribOpen(false)} wide>
        <form onSubmit={onContribute}>
          <div className="form-grid">
            <div>
              <label className="label-field">المتجر</label>
              <select className="input-field" required value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                {stores.filter((s) => s.active).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">المصدر</label>
              <select
                className="input-field"
                value={mode}
                onChange={(e) => setMode(e.target.value as "existing" | "new")}
              >
                <option value="existing">صنف موجود في المخزون</option>
                <option value="new">صنف جديد في المخزون</option>
              </select>
            </div>
            {mode === "existing" ? (
              <div className="full">
                <label className="label-field">الصنف</label>
                <select
                  className="input-field"
                  required
                  value={inventoryItemId}
                  onChange={(e) => setInventoryItemId(e.target.value)}
                >
                  {inventory.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.skuCode} —{" "}
                      {schema.map((f) => String(i.attributes[f.key] ?? "")).filter(Boolean).join(" / ")}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              schema.map((f) => (
                <div key={f.key}>
                  <label className="label-field">{f.label}</label>
                  <select
                    className="input-field"
                    value={attrs[f.key] ?? ""}
                    onChange={(e) => setAttrs((a) => ({ ...a, [f.key]: e.target.value }))}
                  >
                    {optionsWithNone(f.options).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
              ))
            )}
            <div>
              <label className="label-field">الكمية</label>
              <input
                className="input-field"
                dir="ltr"
                inputMode="decimal"
                required
                value={qty}
                onChange={(e) => setQty(sanitizeNumericInput(e.target.value, true))}
              />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-primary" type="submit" disabled={busy}>
              حفظ المساهمة
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

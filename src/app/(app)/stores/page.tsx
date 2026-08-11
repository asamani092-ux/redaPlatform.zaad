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

type StoreTotals = {
  added: number;
  dispensed: number;
  returned: number;
  remaining: number;
  itemCount: number;
};

/**
 * تبويب المتاجر: جدول متاجر → تفاصيل بنافذة عند الضغط.
 * Time: O(n) للتجميع والعرض.
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
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [contribOpen, setContribOpen] = useState(false);
  const [detailStoreId, setDetailStoreId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [storeId, setStoreId] = useState("");
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [inventoryItemId, setInventoryItemId] = useState("");
  const [qty, setQty] = useState("1");
  const [attrs, setAttrs] = useState<Record<string, string>>({});

  async function load() {
    const [storesRes, invRes] = await Promise.all([
      fetch("/api/stores"),
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
  }, []);

  const defaultAttrs = useMemo(() => {
    const next: Record<string, string> = {};
    for (const f of schema) next[f.key] = f.options[0] ?? "";
    return next;
  }, [schema]);

  const totalsByStore = useMemo(() => {
    const map = new Map<string, StoreTotals>();
    for (const r of summary) {
      const cur = map.get(r.storeId) ?? {
        added: 0,
        dispensed: 0,
        returned: 0,
        remaining: 0,
        itemCount: 0,
      };
      cur.added += r.added;
      cur.dispensed += r.dispensed;
      cur.returned += r.returned;
      cur.remaining += r.remaining;
      cur.itemCount += 1;
      map.set(r.storeId, cur);
    }
    return map;
  }, [summary]);

  const detailStore = stores.find((s) => s.id === detailStoreId) ?? null;
  const detailRows = useMemo(
    () => (detailStoreId ? summary.filter((r) => r.storeId === detailStoreId) : []),
    [summary, detailStoreId],
  );

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

  function openContribute(forStoreId?: string) {
    setStoreId(forStoreId || stores[0]?.id || "");
    setMode("existing");
    setInventoryItemId(inventory[0]?.id ?? "");
    setAttrs({ ...defaultAttrs });
    setContribOpen(true);
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="المتاجر"
        description="متاجر مشاركة تساهم بمنتجات تدخل المخزون الموحّد — اضغط المتجر لعرض التفاصيل"
        breadcrumb={[{ label: "الرئيسية", href: "/dashboard" }, { label: "المتاجر" }]}
        actions={
          canManage ? (
            <>
              <button type="button" className="btn-primary btn-sm" onClick={() => setAddOpen(true)}>
                إضافة متجر
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => openContribute()}
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
        <h2 className="panel-title">المتاجر ({stores.length})</h2>
        <p className="page-header__desc">اضغط الصف لعرض تفاصيل الأصناف والحصر</p>
        <DataTable
          stack={false}
          empty={!stores.length}
          emptyTitle="لا متاجر بعد"
          emptyBody="أضف متجراً مشاركاً."
        >
          <table>
            <thead>
              <tr>
                <th>المتجر</th>
                <th>الحالة</th>
                <th>أصناف</th>
                <th>مضاف</th>
                <th>مصروف</th>
                <th>متبقي</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((s) => {
                const t = totalsByStore.get(s.id);
                return (
                  <tr
                    key={s.id}
                    className="stores-table__row"
                    tabIndex={0}
                    role="button"
                    onClick={() => setDetailStoreId(s.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setDetailStoreId(s.id);
                      }
                    }}
                  >
                    <td data-label="المتجر">{s.name}</td>
                    <td data-label="الحالة">{s.active ? "نشط" : "متوقف"}</td>
                    <td data-label="أصناف">{t?.itemCount ?? 0}</td>
                    <td data-label="مضاف">{t?.added ?? 0}</td>
                    <td data-label="مصروف">{t?.dispensed ?? 0}</td>
                    <td data-label="متبقي">{t?.remaining ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DataTable>
      </section>

      <Modal
        open={Boolean(detailStore)}
        title={detailStore ? `تفاصيل: ${detailStore.name}` : "تفاصيل المتجر"}
        onClose={() => setDetailStoreId(null)}
        wide
      >
        {detailStore ? (
          <>
            <p className="page-header__desc">
              {detailStore.notes || "بدون ملاحظات"} — {detailStore.active ? "نشط" : "متوقف"}
            </p>
            {canManage ? (
              <div className="form-actions" style={{ marginTop: "0.5rem" }}>
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  onClick={() => {
                    openContribute(detailStore.id);
                  }}
                >
                  تسجيل مساهمة لهذا المتجر
                </button>
              </div>
            ) : null}
            <div className="table-wrap table-wrap--stack" style={{ marginTop: "0.75rem" }}>
              <table>
                <thead>
                  <tr>
                    <th>الرمز</th>
                    <th>الصنف</th>
                    <th>مضاف</th>
                    <th>مصروف</th>
                    <th>مرتجع</th>
                    <th>متبقي</th>
                  </tr>
                </thead>
                <tbody>
                  {detailRows.map((r) => (
                    <tr key={`${r.storeId}:${r.inventoryItemId}`}>
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
                  {!detailRows.length ? (
                    <tr>
                      <td colSpan={6} className="empty">
                        لا مساهمات لهذا المتجر بعد
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="form-actions" style={{ marginTop: "0.75rem" }}>
              <button type="button" className="btn-secondary" onClick={() => setDetailStoreId(null)}>
                إغلاق
              </button>
            </div>
          </>
        ) : null}
      </Modal>

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
            <button
              className="btn-secondary"
              type="button"
              disabled={busy}
              onClick={() => setAddOpen(false)}
            >
              إلغاء
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
            <button
              className="btn-secondary"
              type="button"
              disabled={busy}
              onClick={() => setContribOpen(false)}
            >
              إلغاء
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

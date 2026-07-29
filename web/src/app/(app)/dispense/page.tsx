"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { AttrChips } from "@/components/AttrChips";

type Item = {
  id: string;
  attributes?: Record<string, unknown>;
  attributesJson?: Record<string, unknown>;
  quantity: number;
};

type BeneficiaryInfo = {
  id: string;
  name: string;
  nationalId: string;
  attendances: unknown[];
  dispenseOrders: unknown[];
};

export default function DispensePage() {
  const [q, setQ] = useState("");
  const [beneficiary, setBeneficiary] = useState<BeneficiaryInfo | null>(null);
  const [entitled, setEntitled] = useState(1);
  const [items, setItems] = useState<Item[]>([]);
  const [lines, setLines] = useState<Record<string, number>>({});
  const [override, setOverride] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/inventory")
      .then((r) => r.json())
      .then((j) => {
        if (j.data) setItems(j.data.map((i: Item) => ({ ...i, quantity: Number(i.quantity) })));
      })
      .catch(() => undefined);
  }, []);

  async function search(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    const res = await fetch(`/api/dispense?q=${encodeURIComponent(q)}`);
    const json = await res.json();
    if (!res.ok) {
      setMsg(json.error || "فشل البحث");
      return;
    }
    setBeneficiary(json.beneficiary);
    setEntitled(json.entitledPieces ?? 1);
    if (!json.beneficiary) setMsg("لم يُعثر على مستفيد");
  }

  async function submit() {
    if (!beneficiary) return;
    const selected = Object.entries(lines)
      .filter(([, qty]) => qty > 0)
      .map(([inventoryItemId, quantity]) => ({ inventoryItemId, quantity }));
    const res = await fetch("/api/dispense", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        beneficiaryId: beneficiary.id,
        lines: selected,
        entitledOverride: override ? Number(override) : undefined,
        overrideReason: overrideReason || undefined,
        sendThanks: true,
      }),
    });
    const json = await res.json();
    setMsg(res.ok ? "تم الصرف بنجاح" : json.error || "فشل الصرف");
    if (res.ok) {
      setLines({});
      setBeneficiary(null);
      setQ("");
    }
  }

  return (
    <div className="page-stack">
      <PageHeader title="صرف القطع" description="يشترط تسجيل الحضور قبل الصرف" />
      {msg ? <p className="msg">{msg}</p> : null}

      <section className="panel">
        <h2 className="panel-title">بحث المستفيد</h2>
        <form onSubmit={search} className="toolbar">
          <input
            className="input-field"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="هوية / جوال / اسم"
          />
          <button className="btn-primary" type="submit">
            بحث
          </button>
        </form>
      </section>

      {beneficiary ? (
        <section className="panel">
          <h2 className="panel-title">بيانات الصرف</h2>
          <div style={{ marginBottom: "1rem" }}>
            <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--tmkeen-primary)" }}>
              {beneficiary.name}
            </div>
            <div dir="ltr">{beneficiary.nationalId}</div>
            <div style={{ marginTop: "0.6rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <span className={`badge ${beneficiary.attendances?.length ? "badge-success" : "badge-danger"}`}>
                الحضور: {beneficiary.attendances?.length ? "مسجل" : "غير مسجل"}
              </span>
              <span className="badge badge-muted">الاستحقاق: {entitled}</span>
            </div>
          </div>

          <div className="form-grid" style={{ marginBottom: "1rem" }}>
            <div>
              <label className="label-field">تعديل الاستحقاق (مشرف)</label>
              <input className="input-field" dir="ltr" value={override} onChange={(e) => setOverride(e.target.value)} />
            </div>
            <div>
              <label className="label-field">سبب التعديل</label>
              <input className="input-field" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>الصنف</th>
                  <th>المتاح</th>
                  <th>الكمية للصرف</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <AttrChips attributes={item.attributes ?? item.attributesJson} />
                    </td>
                    <td>{item.quantity}</td>
                    <td style={{ maxWidth: 140 }}>
                      <input
                        type="number"
                        min={0}
                        step="0.001"
                        className="input-field"
                        dir="ltr"
                        value={lines[item.id] ?? 0}
                        onChange={(e) =>
                          setLines((prev) => ({ ...prev, [item.id]: Number(e.target.value) }))
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="form-actions">
            <button className="btn-primary" type="button" onClick={submit}>
              تأكيد الصرف
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

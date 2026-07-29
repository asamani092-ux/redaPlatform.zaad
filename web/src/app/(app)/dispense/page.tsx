"use client";

import { FormEvent, useEffect, useState } from "react";

type Item = {
  id: string;
  attributesJson: Record<string, unknown>;
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
        if (j.data) setItems(j.data.map((i: Item & { quantity: number }) => ({ ...i, quantity: Number(i.quantity) })));
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
    <div className="space-y-4">
      <div className="panel">
        <h1 className="text-2xl font-extrabold text-primary mb-3">صرف القطع</h1>
        <form onSubmit={search} className="flex gap-2 flex-wrap">
          <input
            className="input-field max-w-md"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="هوية / جوال / اسم"
          />
          <button className="btn-primary" type="submit">
            بحث
          </button>
        </form>
        {msg ? <p className="mt-3 font-semibold text-primary">{msg}</p> : null}
      </div>

      {beneficiary ? (
        <div className="panel space-y-3">
          <div>
            <div className="text-xl font-bold">{beneficiary.name}</div>
            <div dir="ltr">{beneficiary.nationalId}</div>
            <div className="mt-2">
              الحضور:{" "}
              <span className={`badge ${beneficiary.attendances?.length ? "badge-success" : "badge-danger"}`}>
                {beneficiary.attendances?.length ? "مسجل" : "غير مسجل"}
              </span>
            </div>
            <div className="mt-1">الاستحقاق الافتراضي: {entitled}</div>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
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
                    <td>{JSON.stringify(item.attributesJson ?? (item as unknown as { attributes: unknown }).attributes)}</td>
                    <td>{item.quantity}</td>
                    <td>
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
          <button className="btn-primary" type="button" onClick={submit}>
            تأكيد الصرف
          </button>
        </div>
      ) : null}
    </div>
  );
}

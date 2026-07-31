"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { BeneficiaryCard } from "@/components/BeneficiaryCard";
import { AttrChips } from "@/components/AttrChips";

type Item = {
  id: string;
  attributes?: Record<string, unknown>;
  attributesJson?: Record<string, unknown>;
  quantity: number;
};

type Lookup = {
  beneficiary: {
    id: string;
    name: string;
    nationalId: string;
    mobile: string;
    association?: string | null;
    dependentsCount?: number;
  };
  statusLabel: string;
  attendance: { type: string } | null;
  dispensed: boolean;
  entitledPieces: number;
  baseEntitlement?: number;
  dependentsCount?: number;
  computedEntitlement?: number;
  effectiveEntitlement?: number;
  entitledOverride?: number | null;
  overrideReason?: string | null;
};

export default function DispensePage() {
  const [q, setQ] = useState("");
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [lines, setLines] = useState<Record<string, number>>({});
  const [override, setOverride] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [msg, setMsg] = useState("");
  const [scanOn, setScanOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/dispense")
      .then((r) => r.json())
      .then((j) => {
        if (j.items) setItems(j.items.map((i: Item) => ({ ...i, quantity: Number(i.quantity) })));
      })
      .catch(() => undefined);
  }, []);

  const preview = useCallback(async (params: { qrToken?: string; q?: string }) => {
    setMsg("");
    const qs = new URLSearchParams();
    if (params.qrToken) qs.set("qrToken", params.qrToken);
    if (params.q) qs.set("q", params.q);
    const res = await fetch(`/api/lookup?${qs}`);
    const json = await res.json();
    if (!res.ok) {
      setLookup(null);
      setMsg(json.error || "تعذر الجلب");
      return;
    }
    setLookup(json);
    setOverride("");
    setOverrideReason("");
  }, []);

  const onScan = useCallback(
    (value: string) => {
      setScanOn(false);
      preview({ qrToken: value });
    },
    [preview],
  );

  const raising = useMemo(() => {
    if (!lookup || !override) return false;
    const n = Number(override);
    const computed = lookup.computedEntitlement ?? lookup.entitledPieces;
    return Number.isFinite(n) && n > 0 && n !== computed;
  }, [lookup, override]);

  const reasonOk = !raising || overrideReason.trim().length > 0;

  async function submit() {
    if (!lookup || busy) return;
    if (raising && !reasonOk) {
      setMsg("سبب رفع الاستحقاق مطلوب");
      return;
    }
    setBusy(true);
    setMsg("");
    const selected = Object.entries(lines)
      .filter(([, qty]) => qty > 0)
      .map(([inventoryItemId, quantity]) => ({ inventoryItemId, quantity }));
    const res = await fetch("/api/dispense", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        beneficiaryId: lookup.beneficiary.id,
        lines: selected,
        entitledOverride: raising ? Number(override) : undefined,
        overrideReason: raising ? overrideReason.trim() : undefined,
        sendThanks: true,
      }),
    });
    const json = await res.json();
    setBusy(false);
    setMsg(res.ok ? "تم الصرف بنجاح" : json.error || "فشل الصرف");
    if (res.ok) {
      setLines({});
      setLookup(null);
      setQ("");
      setOverride("");
      setOverrideReason("");
    }
  }

  const effective =
    lookup?.effectiveEntitlement ??
    lookup?.computedEntitlement ??
    lookup?.entitledPieces ??
    0;

  return (
    <div className="page-stack">
      <PageHeader
        title="صرف القطع"
        description="يشترط الحضور — امسح أو ابحث ثم أكّد بعد المعاينة"
        actions={
          <button type="button" className="btn-recommend" onClick={() => setScanOn((v) => !v)}>
            {scanOn ? "إيقاف الكاميرا" : "مسح بالكاميرا"}
          </button>
        }
      />
      {msg ? <p className="msg">{msg}</p> : null}

      <section className="panel">
        <h2 className="panel-title">بحث المستفيد</h2>
        {scanOn ? <BarcodeScanner active={scanOn} onScan={onScan} /> : null}
        <div className="toolbar" style={{ marginTop: scanOn ? "1rem" : 0 }}>
          <input
            className="input-field"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="هوية / جوال / اسم"
          />
          <button type="button" className="btn-primary" onClick={() => preview({ q })}>
            معاينة
          </button>
        </div>
      </section>

      {lookup ? (
        <section className="panel">
          <h2 className="panel-title">بيانات الصرف</h2>
          <BeneficiaryCard
            name={lookup.beneficiary.name}
            nationalId={lookup.beneficiary.nationalId}
            mobile={lookup.beneficiary.mobile}
            association={lookup.beneficiary.association}
            statusLabel={lookup.statusLabel}
            extra={
              <>
                <span className={`badge ${lookup.attendance ? "badge-success" : "badge-danger"}`}>
                  الحضور: {lookup.attendance ? "مسجل" : "غير مسجل"}
                </span>
                <span className="badge badge-muted">
                  الاستحقاق الفعلي: {effective}
                </span>
                <span className="badge badge-muted">
                  أساسي: {lookup.baseEntitlement ?? "—"} / تابعون:{" "}
                  {lookup.dependentsCount ?? lookup.beneficiary.dependentsCount ?? 0}
                </span>
                {lookup.entitledOverride != null ? (
                  <span className="badge badge-warning">
                    استثناء معتمد: {lookup.entitledOverride}
                    {lookup.overrideReason ? ` — ${lookup.overrideReason}` : ""}
                  </span>
                ) : null}
                {lookup.dispensed ? <span className="badge badge-warning">تم الصرف سابقاً</span> : null}
              </>
            }
          />

          <div className="form-grid" style={{ marginTop: "1rem" }}>
            <div>
              <label className="label-field">رفع الاستحقاق (موظف التوزيع / المدير)</label>
              <input
                className="input-field"
                dir="ltr"
                type="number"
                min={1}
                placeholder={String(lookup.computedEntitlement ?? lookup.entitledPieces)}
                value={override}
                onChange={(e) => setOverride(e.target.value)}
              />
            </div>
            <div>
              <label className="label-field">سبب الرفع (إلزامي عند الرفع)</label>
              <input
                className="input-field"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                required={raising}
                placeholder="لا يُقبل الإرسال وسبب فارغ"
              />
            </div>
          </div>
          {raising && !reasonOk ? (
            <p className="msg msg-error">أدخل سبباً حقيقياً قبل تأكيد الصرف مع رفع الاستحقاق</p>
          ) : null}

          <div className="table-wrap" style={{ marginTop: "1rem" }}>
            <table>
              <thead>
                <tr>
                  <th>الصنف</th>
                  <th>المتاح</th>
                  <th>الكمية</th>
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
            <button
              className="btn-primary"
              type="button"
              disabled={busy || !lookup.attendance || lookup.dispensed || !reasonOk}
              onClick={submit}
            >
              {busy ? "جاري..." : "تأكيد الصرف"}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

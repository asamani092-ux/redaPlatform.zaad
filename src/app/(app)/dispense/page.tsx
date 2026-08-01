"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { BeneficiaryCard } from "@/components/BeneficiaryCard";
import { AttrChips } from "@/components/AttrChips";
import { sanitizeNumericInput, toIntOrNull } from "@/lib/num";

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
  // كميات نصّية لتفادي قفل حقول type=number مع الأرقام العربية — O(1) لكل تحديث
  const [lines, setLines] = useState<Record<string, string>>({});
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
    setLines({});
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

  const computed = lookup?.computedEntitlement ?? lookup?.entitledPieces ?? 0;

  const overriding = useMemo(() => {
    if (!lookup || !override) return false;
    const n = toIntOrNull(override);
    return n != null && n > 0 && n !== computed;
  }, [lookup, override, computed]);

  const reasonOk = !overriding || overrideReason.trim().length > 0;

  const selectedLines = useMemo(
    () =>
      Object.entries(lines)
        .map(([inventoryItemId, raw]) => ({ inventoryItemId, quantity: toIntOrNull(raw) ?? 0 }))
        .filter((l) => l.quantity > 0),
    [lines],
  );
  const totalSelected = selectedLines.reduce((s, l) => s + l.quantity, 0);
  const entitledNow = overriding ? (toIntOrNull(override) ?? computed) : computed;

  async function submit() {
    if (!lookup || busy) return;
    if (!selectedLines.length) {
      setMsg("حدد كمية لصنف واحد على الأقل قبل تأكيد الصرف");
      return;
    }
    if (overriding && !reasonOk) {
      setMsg("سبب تعديل الاستحقاق مطلوب");
      return;
    }
    if (totalSelected > entitledNow) {
      setMsg(`مجموع الكميات (${totalSelected}) يتجاوز الاستحقاق (${entitledNow})`);
      return;
    }
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/dispense", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        beneficiaryId: lookup.beneficiary.id,
        lines: selectedLines,
        entitledOverride: overriding ? toIntOrNull(override) : undefined,
        overrideReason: overriding ? overrideReason.trim() : undefined,
        sendThanks: true,
      }),
    });
    const json = await res.json().catch(() => ({}));
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
        description="يشترط الحضور — امسح أو ابحث ثم أكّد بعد المعاينة. يجوز الصرف بأقل من الاستحقاق"
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
              <label className="label-field">
                تعديل الاستحقاق — رفع أو خفض (موظف التوزيع / المدير)
              </label>
              <input
                className="input-field"
                dir="ltr"
                inputMode="numeric"
                placeholder={String(computed)}
                value={override}
                onChange={(e) => setOverride(sanitizeNumericInput(e.target.value, false))}
              />
            </div>
            <div>
              <label className="label-field">سبب التعديل (إلزامي عند التعديل)</label>
              <input
                className="input-field"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                required={overriding}
                placeholder="لا يُقبل الإرسال وسبب فارغ"
              />
            </div>
          </div>
          {overriding && !reasonOk ? (
            <p className="msg msg-error">أدخل سبباً حقيقياً قبل تأكيد الصرف مع تعديل الاستحقاق</p>
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
                        type="text"
                        inputMode="numeric"
                        className="input-field"
                        dir="ltr"
                        placeholder="0"
                        value={lines[item.id] ?? ""}
                        onChange={(e) =>
                          setLines((prev) => ({
                            ...prev,
                            [item.id]: sanitizeNumericInput(e.target.value, false),
                          }))
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="page-header__desc" style={{ marginTop: "0.75rem" }}>
            المحدد: {totalSelected} من الاستحقاق {entitledNow} — يجوز الصرف بأقل من الاستحقاق
          </p>
          <div className="form-actions">
            <button
              className="btn-primary"
              type="button"
              disabled={
                busy ||
                !lookup.attendance ||
                lookup.dispensed ||
                !reasonOk ||
                !selectedLines.length ||
                totalSelected > entitledNow
              }
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

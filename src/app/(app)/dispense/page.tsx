"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/PageHeader";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { BeneficiaryCard } from "@/components/BeneficiaryCard";
import { AttrChips } from "@/components/AttrChips";
import { sanitizeNumericInput, toIntOrNull } from "@/lib/num";
import type { InventorySchemaField } from "@/lib/inventory-schema";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";

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
  dispenseCount?: number;
  previousPiecesTotal?: number;
  entitledPieces: number;
  baseEntitlement?: number;
  dependentsEntitlement?: number;
  dependentsCount?: number;
  computedEntitlement?: number;
  effectiveEntitlement?: number;
  entitledOverride?: number | null;
  overrideReason?: string | null;
};

export default function DispensePage() {
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const canOverride = role ? hasPermission(role, "dispense:override") : false;

  const [q, setQ] = useState("");
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [schema, setSchema] = useState<InventorySchemaField[]>([]);
  // كميات نصّية لتفادي قفل حقول type=number مع الأرقام العربية — O(1) لكل تحديث
  const [lines, setLines] = useState<Record<string, string>>({});
  // قطع إضافية فوق الاستحقاق — لا تُستبدل الاستحقاق المحسوب
  const [extraAbove, setExtraAbove] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [repeatReason, setRepeatReason] = useState("");
  const [msg, setMsg] = useState("");
  const [scanOn, setScanOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/dispense")
      .then((r) => r.json())
      .then((j) => {
        if (j.items) setItems(j.items.map((i: Item) => ({ ...i, quantity: Number(i.quantity) })));
        if (j.inventorySchema) setSchema(j.inventorySchema);
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
    setExtraAbove("");
    setOverrideReason("");
    setRepeatReason("");
  }, []);

  const onScan = useCallback(
    (value: string) => {
      setScanOn(false);
      preview({ qrToken: value });
    },
    [preview],
  );

  const computed = lookup?.computedEntitlement ?? lookup?.entitledPieces ?? 0;

  const extraN = useMemo(() => {
    const n = toIntOrNull(extraAbove);
    return n != null && n > 0 ? n : 0;
  }, [extraAbove]);

  const addingExtra = extraN > 0;
  const reasonOk = !addingExtra || overrideReason.trim().length > 0;
  const alreadyDispensed = Boolean(lookup?.dispensed);
  const repeatOk = !alreadyDispensed || (canOverride && repeatReason.trim().length > 0);

  const selectedLines = useMemo(
    () =>
      Object.entries(lines)
        .map(([inventoryItemId, raw]) => ({ inventoryItemId, quantity: toIntOrNull(raw) ?? 0 }))
        .filter((l) => l.quantity > 0),
    [lines],
  );
  const totalSelected = selectedLines.reduce((s, l) => s + l.quantity, 0);
  const entitledNow = computed + extraN;

  async function submit() {
    if (!lookup || busy) return;
    if (!selectedLines.length) {
      setMsg("حدد كمية لصنف واحد على الأقل قبل تأكيد الصرف");
      return;
    }
    if (addingExtra && !reasonOk) {
      setMsg("سبب الإضافة فوق الاستحقاق مطلوب");
      return;
    }
    if (alreadyDispensed && !canOverride) {
      setMsg("الصرف المتكرر يتطلب صلاحية الاستثناء (توزيع أو مدير)");
      return;
    }
    if (alreadyDispensed && !repeatReason.trim()) {
      setMsg("سبب الصرف الاستثنائي مطلوب لأن المستفيد صُرف له سابقاً");
      return;
    }
    if (totalSelected > entitledNow) {
      setMsg(`مجموع الكميات (${totalSelected}) يتجاوز المسموح (${entitledNow})`);
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
        extraAbove: addingExtra ? extraN : undefined,
        overrideReason: addingExtra ? overrideReason.trim() : undefined,
        repeatReason: alreadyDispensed ? repeatReason.trim() : undefined,
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
      setExtraAbove("");
      setOverrideReason("");
      setRepeatReason("");
    }
  }

  // الفعلي المعروض = المحسوب (أساسي + تابعون × وحدة) — لا يُستبدل باستثناء صرف سابق
  const effective =
    lookup?.computedEntitlement ??
    lookup?.effectiveEntitlement ??
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
                  أساسي: {lookup.baseEntitlement ?? "—"} + تابعون:{" "}
                  {lookup.dependentsCount ?? lookup.beneficiary.dependentsCount ?? 0} ×{" "}
                  {lookup.dependentsEntitlement ?? 0} ={" "}
                  {lookup.computedEntitlement ?? lookup.entitledPieces ?? "—"}
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

          {lookup.dispensed ? (
            <div className="panel" style={{ marginTop: "1rem", borderColor: "var(--warning, #d97706)" }}>
              <p className="page-header__desc">
                صُرف لهذا المستفيد سابقاً
                {typeof lookup.dispenseCount === "number" ? ` (${lookup.dispenseCount} مرة)` : ""}
                {typeof lookup.previousPiecesTotal === "number"
                  ? ` — إجمالي القطع السابقة: ${lookup.previousPiecesTotal}`
                  : ""}
                . السجل السابق لا يُحذف؛ الصرف الجديد يُضاف تراكمياً.
              </p>
              {canOverride ? (
                <div style={{ marginTop: "0.75rem" }}>
                  <label className="label-field" htmlFor="repeat-reason">
                    سبب الصرف الاستثنائي *
                  </label>
                  <textarea
                    id="repeat-reason"
                    className="input-field"
                    rows={3}
                    value={repeatReason}
                    onChange={(e) => setRepeatReason(e.target.value)}
                    placeholder="مثال: خطأ في الكمية السابقة / توجيه إداري…"
                  />
                </div>
              ) : (
                <p className="msg msg-error" style={{ marginTop: "0.75rem" }}>
                  لا تملك صلاحية الصرف الاستثنائي — اطلب من مشرف التوزيع أو المدير.
                </p>
              )}
            </div>
          ) : null}

          <div className="form-grid" style={{ marginTop: "1rem" }}>
            <div>
              <label className="label-field">
                قطع إضافية فوق الاستحقاق ({computed}) — ليست من ضمنه
              </label>
              <input
                className="input-field"
                dir="ltr"
                inputMode="numeric"
                placeholder="0"
                value={extraAbove}
                onChange={(e) => setExtraAbove(sanitizeNumericInput(e.target.value, false))}
              />
            </div>
            <div>
              <label className="label-field">سبب الإضافة (إلزامي عند الإضافة)</label>
              <input
                className="input-field"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                required={addingExtra}
                placeholder="مثال: عائلة كبيرة / حالة خاصة"
              />
            </div>
          </div>
          {addingExtra ? (
            <p className="page-header__desc" style={{ marginTop: "0.5rem" }}>
              المسموح الإجمالي = الاستحقاق {computed} + الإضافي {extraN} = {entitledNow}
            </p>
          ) : null}
          {addingExtra && !reasonOk ? (
            <p className="msg msg-error">أدخل سبباً قبل تأكيد الصرف مع قطع إضافية</p>
          ) : null}
          {alreadyDispensed && canOverride && !repeatReason.trim() ? (
            <p className="msg msg-error">أدخل سبب الصرف الاستثنائي قبل التأكيد</p>
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
                      <AttrChips
                        attributes={item.attributes ?? item.attributesJson}
                        schema={schema}
                      />
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
            المحدد: {totalSelected} من المسموح {entitledNow} — يجوز الصرف بأقل من الاستحقاق
          </p>
          <div className="form-actions">
            <button
              className="btn-primary"
              type="button"
              disabled={
                busy ||
                !lookup.attendance ||
                !reasonOk ||
                !repeatOk ||
                !selectedLines.length ||
                totalSelected > entitledNow
              }
              onClick={() => void submit()}
            >
              {busy ? "جاري..." : alreadyDispensed ? "تأكيد الصرف الاستثنائي" : "تأكيد الصرف"}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

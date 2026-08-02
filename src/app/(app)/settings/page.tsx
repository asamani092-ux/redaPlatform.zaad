"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { InventorySchemaField } from "@/lib/inventory-schema";
import { DEFAULT_INVENTORY_SCHEMA } from "@/lib/inventory-schema";
import { sanitizeNumericInput, toIntOrNull } from "@/lib/num";

type Association = { id?: string; name: string; active?: boolean };

export default function SettingsPage() {
  const [exhibitionName, setExhibitionName] = useState("");
  const [location, setLocation] = useState("");
  const [baseEntitlement, setBaseEntitlement] = useState("2");
  const [lowStockThreshold, setLowStockThreshold] = useState("10");
  const [schema, setSchema] = useState<InventorySchemaField[]>(DEFAULT_INVENTORY_SCHEMA);
  const [associations, setAssociations] = useState<Association[]>([]);
  const [inviteTpl, setInviteTpl] = useState("");
  const [thanksTpl, setThanksTpl] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasItems, setHasItems] = useState(false);

  // إعداد واتساب — يُحفظ ويُختبر مستقلاً عن نموذج الإعدادات الرئيسي
  const [wa, setWa] = useState({
    provider: "stub",
    apiUrl: "",
    token: "",
    tokenMask: "",
    hasToken: false,
    sender: "",
  });
  const [waMsg, setWaMsg] = useState("");
  const [waBusy, setWaBusy] = useState(false);
  const [testMobile, setTestMobile] = useState("");

  useEffect(() => {
    fetch("/api/settings/whatsapp")
      .then((r) => r.json())
      .then((j) => {
        if (j.provider) {
          setWa((w) => ({
            ...w,
            provider: j.provider,
            apiUrl: j.apiUrl ?? "",
            tokenMask: j.tokenMask ?? "",
            hasToken: !!j.hasToken,
            sender: j.sender ?? "",
          }));
        }
      })
      .catch(() => undefined);
  }, []);

  async function saveWhatsApp() {
    if (waBusy) return;
    setWaBusy(true);
    setWaMsg("");
    const res = await fetch("/api/settings/whatsapp", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: wa.provider,
        apiUrl: wa.apiUrl,
        apiToken: wa.token || null,
        sender: wa.sender,
      }),
    });
    const json = await res.json();
    setWaBusy(false);
    if (!res.ok) {
      setWaMsg(json.error || "فشل الحفظ");
      return;
    }
    setWa((w) => ({
      ...w,
      token: "",
      tokenMask: json.tokenMask ?? "",
      hasToken: !!json.hasToken,
    }));
    setWaMsg("تم حفظ إعداد واتساب");
  }

  async function testWhatsApp() {
    if (waBusy || !testMobile.trim()) return;
    setWaBusy(true);
    setWaMsg("");
    const res = await fetch("/api/settings/whatsapp/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile: testMobile.trim() }),
    });
    const json = await res.json();
    setWaBusy(false);
    setWaMsg(res.ok ? json.message : json.error || "فشل الاختبار");
  }

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((j) => {
        if (j.exhibition) {
          setExhibitionName(j.exhibition.name ?? "");
          setLocation(j.exhibition.location ?? "");
          const s = j.exhibition.settings;
          if (s) {
            setBaseEntitlement(String(s.baseEntitlement ?? s.entitledPieces ?? 2));
            setLowStockThreshold(String(s.lowStockThreshold ?? 10));
            if (Array.isArray(s.inventorySchemaJson)) setSchema(s.inventorySchemaJson);
            setInviteTpl(s.whatsappInviteTpl ?? "");
            setThanksTpl(s.whatsappThanksTpl ?? "");
          }
        }
        if (j.associations) setAssociations(j.associations);
        setHasItems(Number(j.inventoryCount ?? 0) > 0);
      });
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exhibitionName,
        location,
        baseEntitlement: toIntOrNull(baseEntitlement) ?? undefined,
        lowStockThreshold: toIntOrNull(lowStockThreshold) ?? undefined,
        inventorySchema: schema,
        associations,
        whatsappInviteTpl: inviteTpl,
        whatsappThanksTpl: thanksTpl,
      }),
    });
    const json = await res.json();
    setBusy(false);
    setMsg(res.ok ? "تم حفظ الإعدادات" : json.error || "فشل الحفظ");
  }

  function updateField(idx: number, patch: Partial<InventorySchemaField>) {
    setSchema((s) => s.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  }

  /** مفتاح داخلي تلقائي غير مرئي للمستخدم — O(1) */
  function nextAutoKey(current: InventorySchemaField[]): string {
    let n = current.length + 1;
    const keys = new Set(current.map((f) => f.key));
    while (keys.has(`attr_${n}`)) n++;
    return `attr_${n}`;
  }

  function setOptionsText(idx: number, text: string) {
    const options = text
      .split("\n")
      .map((o) => o.trim())
      .filter(Boolean);
    updateField(idx, { options });
  }

  return (
    <form onSubmit={save} className="page-stack">
      <PageHeader
        title={exhibitionName ? `إعدادات المعرض: ${exhibitionName}` : "الإعدادات"}
        description="ضبط المعرض والاستحقاق ومخطط المخزون وقوائم الجمعيات"
        actions={
          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? "جاري الحفظ…" : "حفظ الإعدادات"}
          </button>
        }
      />
      {msg ? <p className="msg">{msg}</p> : null}

      <section className="panel">
        <h2 className="panel-title">بيانات المعرض</h2>
        <div className="form-grid">
          <div>
            <label className="label-field">اسم المعرض</label>
            <input
              className="input-field"
              value={exhibitionName}
              onChange={(e) => setExhibitionName(e.target.value)}
            />
          </div>
          <div>
            <label className="label-field">الموقع</label>
            <input className="input-field" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div>
            <label className="label-field">الاستحقاق الأساسي (قطع)</label>
            <input
              className="input-field"
              type="text"
              inputMode="numeric"
              dir="ltr"
              value={baseEntitlement}
              onChange={(e) => setBaseEntitlement(sanitizeNumericInput(e.target.value, false))}
            />
          </div>
          <div>
            <label className="label-field">عتبة تنبيه النفاد</label>
            <input
              className="input-field"
              type="text"
              inputMode="numeric"
              dir="ltr"
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(sanitizeNumericInput(e.target.value, false))}
            />
          </div>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">مخطط سمات المخزون</h2>
        <p className="page-header__desc" style={{ marginBottom: "0.75rem" }}>
          كل سمة لها تسمية عربية وقائمة خيارات (سطر لكل خيار) — مثل: الوحدة، النوع، المقاس.
          بعد إدخال أصناف تبقى السمات ثابتة ويُسمح بإضافة خيارات وتعديل التسميات فقط.
        </p>
        <div style={{ display: "grid", gap: "0.85rem" }}>
          {schema.map((f, idx) => (
            <div key={f.key || idx} className="form-grid form-grid--attrs">
              <div>
                <label className="label-field">التسمية</label>
                <input
                  className="input-field"
                  placeholder="اللون / الوحدة / المقاس"
                  value={f.label}
                  onChange={(e) => updateField(idx, { label: e.target.value })}
                />
              </div>
              <div>
                <label className="label-field">الخيارات (سطر لكل خيار)</label>
                <textarea
                  className="input-field"
                  rows={3}
                  value={f.options.join("\n")}
                  onChange={(e) => setOptionsText(idx, e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="form-actions">
          <button
            type="button"
            className="btn-secondary"
            disabled={hasItems}
            onClick={() =>
              setSchema((s) => [...s, { key: nextAutoKey(s), label: "", options: [] }])
            }
          >
            إضافة سمة
          </button>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">قائمة الجمعيات</h2>
        <div style={{ display: "grid", gap: "0.55rem" }}>
          {associations.map((a, idx) => (
            <input
              key={a.id ?? idx}
              className="input-field"
              value={a.name}
              onChange={(e) =>
                setAssociations((list) =>
                  list.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)),
                )
              }
            />
          ))}
        </div>
        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={() => setAssociations((a) => [...a, { name: "" }])}>
            إضافة جمعية
          </button>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">قوالب واتساب</h2>
        <div className="form-grid">
          <div className="full">
            <label className="label-field">قالب الدعوة</label>
            <textarea
              className="input-field"
              rows={3}
              value={inviteTpl}
              onChange={(e) => setInviteTpl(e.target.value)}
            />
          </div>
          <div className="full">
            <label className="label-field">قالب الشكر</label>
            <textarea
              className="input-field"
              rows={3}
              value={thanksTpl}
              onChange={(e) => setThanksTpl(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">ربط واتساب (المزوّد)</h2>
        <p className="page-header__desc" style={{ marginBottom: "0.75rem" }}>
          رقم المرسل يُسجل لدى المزوّد (مثل Meta WhatsApp Cloud API) ثم تُنقل بياناته هنا.
          الوضع التجريبي يسجّل الرسائل داخلياً دون إرسال حقيقي.
        </p>
        {waMsg ? <p className="msg">{waMsg}</p> : null}
        <div className="form-grid">
          <div>
            <label className="label-field">وضع الإرسال</label>
            <select
              className="input-field"
              value={wa.provider}
              onChange={(e) => setWa((w) => ({ ...w, provider: e.target.value }))}
            >
              <option value="stub">تجريبي — تسجيل داخلي بلا إرسال</option>
              <option value="api">فعلي — إرسال عبر مزوّد API</option>
            </select>
          </div>
          <div>
            <label className="label-field">رقم جوال المرسل (للتوثيق)</label>
            <input
              className="input-field"
              dir="ltr"
              inputMode="tel"
              placeholder="9665xxxxxxxx"
              value={wa.sender}
              onChange={(e) => setWa((w) => ({ ...w, sender: e.target.value }))}
            />
          </div>
          <div className="full">
            <label className="label-field">رابط الإرسال (API URL)</label>
            <input
              className="input-field"
              dir="ltr"
              placeholder="https://graph.facebook.com/v20.0/<PHONE_NUMBER_ID>/messages"
              value={wa.apiUrl}
              onChange={(e) => setWa((w) => ({ ...w, apiUrl: e.target.value }))}
            />
          </div>
          <div className="full">
            <label className="label-field">
              التوكن {wa.hasToken ? `— المحفوظ: ${wa.tokenMask} (اتركه فارغاً للإبقاء عليه)` : ""}
            </label>
            <input
              className="input-field"
              dir="ltr"
              type="password"
              autoComplete="off"
              placeholder={wa.hasToken ? "••••••••" : "توكن المزوّد"}
              value={wa.token}
              onChange={(e) => setWa((w) => ({ ...w, token: e.target.value }))}
            />
          </div>
        </div>
        <div className="form-actions">
          <button type="button" className="btn-primary" disabled={waBusy} onClick={saveWhatsApp}>
            {waBusy ? "جاري…" : "حفظ إعداد واتساب"}
          </button>
        </div>
        <div className="toolbar" style={{ marginTop: "0.75rem" }}>
          <input
            className="input-field"
            dir="ltr"
            inputMode="tel"
            placeholder="جوال لاختبار الإرسال 05xxxxxxxx"
            value={testMobile}
            onChange={(e) => setTestMobile(e.target.value)}
          />
          <button
            type="button"
            className="btn-recommend"
            disabled={waBusy || !testMobile.trim()}
            onClick={testWhatsApp}
          >
            إرسال رسالة اختبار
          </button>
        </div>
      </section>
    </form>
  );
}

"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Modal } from "@/components/Modal";
import type { InventorySchemaField } from "@/lib/inventory-schema";
import {
  DEFAULT_INVENTORY_SCHEMA,
  isRequiredInventoryAttrKey,
  REQUIRED_INVENTORY_ATTR_LABELS,
} from "@/lib/inventory-schema";
import { sanitizeNumericInput, toIntOrNull } from "@/lib/num";

type Association = { id?: string; name: string; active?: boolean };
type Section = "exhibition" | "schema" | "associations" | "templates" | "whatsapp" | null;

export default function SettingsPage() {
  const [exhibitionName, setExhibitionName] = useState("");
  const [location, setLocation] = useState("");
  const [baseEntitlement, setBaseEntitlement] = useState("2");
  const [dependentsEntitlement, setDependentsEntitlement] = useState("0");
  const [lowStockThreshold, setLowStockThreshold] = useState("10");
  const [schema, setSchema] = useState<InventorySchemaField[]>(DEFAULT_INVENTORY_SCHEMA);
  const [associations, setAssociations] = useState<Association[]>([]);
  const [inviteTpl, setInviteTpl] = useState("");
  const [thanksTpl, setThanksTpl] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasItems, setHasItems] = useState(false);
  const [section, setSection] = useState<Section>(null);

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
            setDependentsEntitlement(String(s.dependentsEntitlement ?? 0));
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

  async function saveSettings() {
    if (busy) return;
    setBusy(true);
    setMsg("");
    // تنظيف الخيارات الفارغة عند الحفظ فقط — أثناء الكتابة تبقى الأسطر فارغة مسموحة
    const cleanedSchema = schema.map((f) => ({
      ...f,
      label: f.label.trim(),
      options: f.options.map((o) => o.trim()).filter(Boolean),
    }));
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exhibitionName,
        location,
        baseEntitlement: toIntOrNull(baseEntitlement) ?? undefined,
        dependentsEntitlement: toIntOrNull(dependentsEntitlement) ?? 0,
        lowStockThreshold: toIntOrNull(lowStockThreshold) ?? undefined,
        inventorySchema: cleanedSchema,
        associations,
        whatsappInviteTpl: inviteTpl,
        whatsappThanksTpl: thanksTpl,
      }),
    });
    const json = await res.json();
    setBusy(false);
    setMsg(res.ok ? "تم حفظ الإعدادات" : json.error || "فشل الحفظ");
    if (res.ok) {
      setSchema(cleanedSchema);
      setSection(null);
    }
  }

  async function onSaveSection(e: FormEvent) {
    e.preventDefault();
    await saveSettings();
  }

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

  function updateField(idx: number, patch: Partial<InventorySchemaField>) {
    setSchema((s) => s.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  }

  function nextAutoKey(current: InventorySchemaField[]): string {
    let n = current.length + 1;
    const keys = new Set(current.map((f) => f.key));
    while (keys.has(`attr_${n}`)) n++;
    return `attr_${n}`;
  }

  /** أثناء الكتابة لا نحذف الأسطر الفارغة حتى يعمل Enter لإضافة خيار — O(n) */
  function setOptionsText(idx: number, text: string) {
    updateField(idx, { options: text.split("\n") });
  }

  function setOptionAt(fieldIdx: number, optIdx: number, value: string) {
    setSchema((s) =>
      s.map((f, i) => {
        if (i !== fieldIdx) return f;
        const options = [...f.options];
        options[optIdx] = value;
        return { ...f, options };
      }),
    );
  }

  function addOption(fieldIdx: number) {
    setSchema((s) =>
      s.map((f, i) => (i === fieldIdx ? { ...f, options: [...f.options, ""] } : f)),
    );
  }

  function removeOption(fieldIdx: number, optIdx: number) {
    setSchema((s) =>
      s.map((f, i) => {
        if (i !== fieldIdx) return f;
        return { ...f, options: f.options.filter((_, oi) => oi !== optIdx) };
      }),
    );
  }

  function removeAttribute(fieldIdx: number) {
    const field = schema[fieldIdx];
    if (!field) return;
    if (isRequiredInventoryAttrKey(field.key)) {
      setMsg(
        `لا يمكن حذف «${REQUIRED_INVENTORY_ATTR_LABELS[field.key] ?? field.label}» — سمة معتمدة`,
      );
      return;
    }
    setSchema((s) => s.filter((_, i) => i !== fieldIdx));
  }

  const cards: Array<{ id: Exclude<Section, null>; title: string; desc: string }> = [
    { id: "exhibition", title: "المعرض والاستحقاق", desc: "الاسم، الموقع، القطع، عتبة النفاد" },
    { id: "schema", title: "سمات المخزون", desc: "تسميات عربية وخيارات دون مفاتيح ظاهرة" },
    { id: "associations", title: "الجمعيات", desc: "قائمة الجمعيات للمستفيدين" },
    { id: "templates", title: "قوالب واتساب", desc: "نصوص الدعوة والشكر" },
    { id: "whatsapp", title: "ربط واتساب", desc: "المزوّد والتوكن واختبار الإرسال" },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        title={exhibitionName ? `إعدادات: ${exhibitionName}` : "الإعدادات"}
        description="أقسام مختصرة — افتح النافذة المطلوبة وعدّل ثم احفظ"
      />
      {msg ? <p className="msg">{msg}</p> : null}

      <section className="panel">
        <div className="stat-grid">
          {cards.map((c) => (
            <button
              key={c.id}
              type="button"
              className="stat-tile"
              style={{ textAlign: "start", cursor: "pointer", border: "1px solid var(--tmkeen-surface-border)" }}
              onClick={() => {
                setMsg("");
                setWaMsg("");
                setSection(c.id);
              }}
            >
              <div className="label" style={{ color: "var(--tmkeen-primary)", fontWeight: 800, fontSize: "1rem" }}>
                {c.title}
              </div>
              <div className="label" style={{ marginTop: "0.35rem" }}>
                {c.desc}
              </div>
            </button>
          ))}
        </div>
      </section>

      <Modal
        open={section === "exhibition"}
        title="المعرض والاستحقاق"
        onClose={() => setSection(null)}
      >
        <form onSubmit={onSaveSection}>
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
              <label className="label-field">استحقاق التابعين (قطع لكل تابع)</label>
              <input
                className="input-field"
                type="text"
                inputMode="numeric"
                dir="ltr"
                value={dependentsEntitlement}
                onChange={(e) =>
                  setDependentsEntitlement(sanitizeNumericInput(e.target.value, false))
                }
              />
              <p className="page-header__desc" style={{ marginTop: "0.35rem" }}>
                الكامل = الأساسي + (عدد التابعين × استحقاق التابع)
              </p>
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
          <div className="form-actions">
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? "جاري…" : "حفظ"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={section === "schema"} title="سمات المخزون" onClose={() => setSection(null)} wide>
        <form onSubmit={onSaveSection}>
          <p className="page-header__desc" style={{ marginBottom: "0.75rem" }}>
            اللون والوحدة معتمدتان ولا تُحذفان. يمكن حذف النوع أو الصنف إن اكتفيت بواحد منهما.
          </p>
          <div style={{ display: "grid", gap: "1rem" }}>
            {schema.map((f, idx) => (
              <div
                key={f.key || idx}
                style={{
                  border: "1px solid var(--tmkeen-surface-border)",
                  borderRadius: "0.75rem",
                  padding: "0.85rem",
                  display: "grid",
                  gap: "0.65rem",
                }}
              >
                <div className="toolbar" style={{ justifyContent: "space-between", alignItems: "end" }}>
                  <div style={{ flex: 1 }}>
                    <label className="label-field">
                      التسمية
                      {isRequiredInventoryAttrKey(f.key) ? (
                        <span className="badge badge-muted" style={{ marginInlineStart: "0.4rem" }}>
                          معتمدة
                        </span>
                      ) : null}
                    </label>
                    <input
                      className="input-field"
                      placeholder="اللون / الوحدة / المقاس"
                      value={f.label}
                      onChange={(e) => updateField(idx, { label: e.target.value })}
                    />
                  </div>
                  {!isRequiredInventoryAttrKey(f.key) ? (
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => removeAttribute(idx)}
                    >
                      حذف السمة
                    </button>
                  ) : null}
                </div>
                <div>
                  <label className="label-field">الخيارات</label>
                  <div style={{ display: "grid", gap: "0.45rem" }}>
                    {f.options.map((opt, oi) => (
                      <div key={`${f.key}-opt-${oi}`} className="toolbar" style={{ alignItems: "center" }}>
                        <input
                          className="input-field"
                          placeholder={`خيار ${oi + 1}`}
                          value={opt}
                          onChange={(e) => setOptionAt(idx, oi, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addOption(idx);
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => removeOption(idx, oi)}
                          aria-label="حذف الخيار"
                        >
                          حذف
                        </button>
                      </div>
                    ))}
                    <button type="button" className="btn-secondary" onClick={() => addOption(idx)}>
                      إضافة خيار
                    </button>
                  </div>
                  <details style={{ marginTop: "0.55rem" }}>
                    <summary className="page-header__desc" style={{ cursor: "pointer" }}>
                      أو لصق عدة خيارات (سطر لكل خيار)
                    </summary>
                    <textarea
                      className="input-field"
                      rows={4}
                      style={{ marginTop: "0.4rem" }}
                      value={f.options.join("\n")}
                      onChange={(e) => setOptionsText(idx, e.target.value)}
                      placeholder={"قطعة\nمتر\nعلبة"}
                    />
                  </details>
                </div>
              </div>
            ))}
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="btn-secondary"
              disabled={hasItems}
              title={hasItems ? "لا يمكن إضافة سمات جديدة بعد إدخال أصناف" : undefined}
              onClick={() =>
                setSchema((s) => [...s, { key: nextAutoKey(s), label: "", options: [""] }])
              }
            >
              إضافة سمة
            </button>
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? "جاري…" : "حفظ المخطط"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={section === "associations"} title="الجمعيات" onClose={() => setSection(null)}>
        <form onSubmit={onSaveSection}>
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
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setAssociations((a) => [...a, { name: "" }])}
            >
              إضافة جمعية
            </button>
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? "جاري…" : "حفظ"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={section === "templates"} title="قوالب واتساب" onClose={() => setSection(null)} wide>
        <form onSubmit={onSaveSection}>
          <div className="form-grid">
            <div className="full">
              <label className="label-field">
                قالب الدعوة — المتغيرات: {"{{name}}"} {"{{exhibition}}"} {"{{date}}"} {"{{location}}"}{" "}
                {"{{qr}}"} {"{{qr_url}}"}
              </label>
              <textarea
                className="input-field"
                rows={4}
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
          <div className="form-actions">
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? "جاري…" : "حفظ القوالب"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={section === "whatsapp"} title="ربط واتساب" onClose={() => setSection(null)} wide>
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
            <label className="label-field">رقم جوال المرسل</label>
            <input
              className="input-field"
              dir="ltr"
              inputMode="tel"
              value={wa.sender}
              onChange={(e) => setWa((w) => ({ ...w, sender: e.target.value }))}
            />
          </div>
          <div className="full">
            <label className="label-field">رابط الإرسال (API URL)</label>
            <input
              className="input-field"
              dir="ltr"
              value={wa.apiUrl}
              onChange={(e) => setWa((w) => ({ ...w, apiUrl: e.target.value }))}
            />
          </div>
          <div className="full">
            <label className="label-field">
              التوكن {wa.hasToken ? `— المحفوظ: ${wa.tokenMask}` : ""}
            </label>
            <input
              className="input-field"
              dir="ltr"
              type="password"
              autoComplete="off"
              placeholder={wa.hasToken ? "اتركه فارغاً للإبقاء" : "توكن المزوّد"}
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
            placeholder="جوال لاختبار الإرسال"
            value={testMobile}
            onChange={(e) => setTestMobile(e.target.value)}
          />
          <button
            type="button"
            className="btn-recommend"
            disabled={waBusy || !testMobile.trim()}
            onClick={testWhatsApp}
          >
            رسالة اختبار
          </button>
        </div>
      </Modal>
    </div>
  );
}

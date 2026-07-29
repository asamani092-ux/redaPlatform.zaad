"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";

type Association = { id?: string; name: string; active?: boolean };
type SchemaField = { key: string; label: string; type: "text" | "number" };

export default function SettingsPage() {
  const [exhibitionName, setExhibitionName] = useState("");
  const [location, setLocation] = useState("");
  const [entitledPieces, setEntitledPieces] = useState(2);
  const [lowStockThreshold, setLowStockThreshold] = useState(10);
  const [schema, setSchema] = useState<SchemaField[]>([
    { key: "type", label: "النوع", type: "text" },
    { key: "category", label: "الصنف", type: "text" },
    { key: "color", label: "اللون", type: "text" },
    { key: "unit", label: "الوحدة", type: "text" },
  ]);
  const [associations, setAssociations] = useState<Association[]>([]);
  const [inviteTpl, setInviteTpl] = useState("");
  const [thanksTpl, setThanksTpl] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((j) => {
        if (j.exhibition) {
          setExhibitionName(j.exhibition.name ?? "");
          setLocation(j.exhibition.location ?? "");
          const s = j.exhibition.settings;
          if (s) {
            setEntitledPieces(s.entitledPieces);
            setLowStockThreshold(s.lowStockThreshold);
            if (Array.isArray(s.inventorySchemaJson)) setSchema(s.inventorySchemaJson);
            setInviteTpl(s.whatsappInviteTpl ?? "");
            setThanksTpl(s.whatsappThanksTpl ?? "");
          }
        }
        if (j.associations) setAssociations(j.associations);
      });
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exhibitionName,
        location,
        entitledPieces,
        lowStockThreshold,
        inventorySchema: schema,
        associations,
        whatsappInviteTpl: inviteTpl,
        whatsappThanksTpl: thanksTpl,
      }),
    });
    const json = await res.json();
    setMsg(res.ok ? "تم حفظ الإعدادات" : json.error || "فشل الحفظ");
  }

  return (
    <form onSubmit={save} className="page-stack">
      <PageHeader
        title="الإعدادات"
        description="ضبط المعرض والاستحقاق ومخطط المخزون وقوائم الجمعيات"
        actions={
          <button className="btn-primary" type="submit">
            حفظ الإعدادات
          </button>
        }
      />
      {msg ? <p className="msg">{msg}</p> : null}

      <section className="panel">
        <h2 className="panel-title">بيانات المعرض</h2>
        <div className="form-grid">
          <div>
            <label className="label-field">اسم المعرض</label>
            <input className="input-field" value={exhibitionName} onChange={(e) => setExhibitionName(e.target.value)} />
          </div>
          <div>
            <label className="label-field">الموقع</label>
            <input className="input-field" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div>
            <label className="label-field">عدد القطع المستحقة</label>
            <input
              className="input-field"
              type="number"
              min={1}
              dir="ltr"
              value={entitledPieces}
              onChange={(e) => setEntitledPieces(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label-field">عتبة تنبيه النفاد</label>
            <input
              className="input-field"
              type="number"
              min={0}
              dir="ltr"
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(Number(e.target.value))}
            />
          </div>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">مخطط سمات المخزون</h2>
        <div style={{ display: "grid", gap: "0.65rem" }}>
          {schema.map((f, idx) => (
            <div key={idx} className="form-grid" style={{ gridTemplateColumns: "1fr 1fr 140px" }}>
              <input
                className="input-field"
                placeholder="المفتاح"
                value={f.key}
                onChange={(e) =>
                  setSchema((s) => s.map((x, i) => (i === idx ? { ...x, key: e.target.value } : x)))
                }
              />
              <input
                className="input-field"
                placeholder="التسمية"
                value={f.label}
                onChange={(e) =>
                  setSchema((s) => s.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))
                }
              />
              <select
                className="input-field"
                value={f.type}
                onChange={(e) =>
                  setSchema((s) =>
                    s.map((x, i) =>
                      i === idx ? { ...x, type: e.target.value as "text" | "number" } : x,
                    ),
                  )
                }
              >
                <option value="text">نص</option>
                <option value="number">رقم</option>
              </select>
            </div>
          ))}
        </div>
        <div className="form-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setSchema((s) => [...s, { key: "", label: "", type: "text" }])}
          >
            إضافة حقل
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
            <textarea className="input-field" rows={3} value={inviteTpl} onChange={(e) => setInviteTpl(e.target.value)} />
          </div>
          <div className="full">
            <label className="label-field">قالب الشكر</label>
            <textarea className="input-field" rows={3} value={thanksTpl} onChange={(e) => setThanksTpl(e.target.value)} />
          </div>
        </div>
      </section>
    </form>
  );
}

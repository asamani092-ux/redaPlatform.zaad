"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/PageHeader";
import { Modal } from "@/components/Modal";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";
import { sanitizeNumericInput, toIntOrNull } from "@/lib/num";

type Association = { id: string; name: string };
type Beneficiary = {
  id: string;
  name: string;
  nationalId: string;
  mobile: string;
  gender?: "MALE" | "FEMALE" | null;
  city?: string | null;
  neighborhood?: string | null;
  birthDate?: string | null;
  notes?: string | null;
  dependentsCount?: number;
  statusLabel?: string;
  association?: Association | null;
  associationId?: string | null;
  associationOther?: string | null;
};

export default function BeneficiariesPage() {
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const canManage = role ? hasPermission(role, "beneficiaries:manage") : false;

  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Beneficiary[]>([]);
  const [associations, setAssociations] = useState<Association[]>([]);
  const [msg, setMsg] = useState("");
  const [useOther, setUseOther] = useState(false);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [editing, setEditing] = useState<Beneficiary | null>(null);
  const [deleting, setDeleting] = useState<Beneficiary | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(search = q) {
    const res = await fetch(`/api/beneficiaries?q=${encodeURIComponent(search)}`);
    const json = await res.json();
    if (res.ok) setRows(json.data);
  }

  useEffect(() => {
    load();
    fetch("/api/associations")
      .then((r) => r.json())
      .then((j) => setAssociations(j.data ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function payloadFromForm(fd: FormData) {
    return {
      name: String(fd.get("name") ?? ""),
      nationalId: String(fd.get("nationalId") ?? ""),
      mobile: String(fd.get("mobile") ?? ""),
      gender: String(fd.get("gender") || "") || null,
      city: String(fd.get("city") || "") || null,
      neighborhood: String(fd.get("neighborhood") || "") || null,
      birthDate: String(fd.get("birthDate") || "") || null,
      notes: String(fd.get("notes") || "") || null,
      associationId: useOther ? null : String(fd.get("associationId") || "") || null,
      associationOther: useOther ? String(fd.get("associationOther") || "") || null : null,
      dependentsCount:
        toIntOrNull(String(fd.get("dependentsCount") ?? "")) ?? 0,
    };
  }

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/beneficiaries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadFromForm(new FormData(e.currentTarget))),
    });
    const json = await res.json();
    setBusy(false);
    setMsg(res.ok ? "تم الحفظ" : json.error || "فشل الحفظ");
    if (res.ok) {
      e.currentTarget.reset();
      setUseOther(false);
      setOpen(false);
      load();
    }
  }

  async function onEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !editing) return;
    setBusy(true);
    setMsg("");
    const res = await fetch(`/api/beneficiaries/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadFromForm(new FormData(e.currentTarget))),
    });
    const json = await res.json();
    setBusy(false);
    setMsg(res.ok ? "تم تحديث البيانات" : json.error || "فشل التحديث");
    if (res.ok) {
      setEditing(null);
      setUseOther(false);
      load();
    }
  }

  async function onDelete() {
    if (busy || !deleting || deleteConfirmText.trim() !== "حذف") return;
    setBusy(true);
    setMsg("");
    const res = await fetch(`/api/beneficiaries/${deleting.id}`, { method: "DELETE" });
    const json = await res.json();
    setBusy(false);
    setMsg(res.ok ? "تم حذف المستفيد" : json.error || "فشل الحذف");
    if (res.ok) {
      setDeleting(null);
      setDeleteConfirmText("");
      load();
    }
  }

  async function onImport(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setImportErrors([]);
    setMsg("");
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/beneficiaries/import", { method: "POST", body: fd });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    const errs: string[] = Array.isArray(json.errors) ? json.errors : [];
    setImportErrors(errs);
    const created = Number(json.created ?? 0);
    const skipped = Number(json.skipped ?? 0);
    if (!res.ok) {
      setMsg(json.error || json.message || "فشل الاستيراد");
      return;
    }
    setMsg(json.message || `استيراد: ${created} ناجح / ${skipped} متجاوز`);
    if (created > 0) {
      load();
      if (errs.length === 0) setImportOpen(false);
    }
  }

  function openEdit(row: Beneficiary) {
    setUseOther(!!row.associationOther);
    setEditing(row);
  }

  const formFields = (b?: Beneficiary | null) => (
    <div className="form-grid">
      <div>
        <label className="label-field">الاسم</label>
        <input name="name" className="input-field" required defaultValue={b?.name ?? ""} />
      </div>
      <div>
        <label className="label-field">رقم الهوية (10–14 رقماً)</label>
        <input
          name="nationalId"
          className="input-field"
          dir="ltr"
          inputMode="numeric"
          minLength={10}
          maxLength={14}
          pattern="\d{10,14}"
          title="من 10 إلى 14 رقماً"
          required
          defaultValue={b?.nationalId ?? ""}
        />
      </div>
      <div>
        <label className="label-field">الجوال</label>
        <input
          name="mobile"
          className="input-field"
          dir="ltr"
          required
          defaultValue={b?.mobile ?? ""}
        />
      </div>
      <div>
        <label className="label-field">الجنس</label>
        <select name="gender" className="input-field" defaultValue={b?.gender ?? ""}>
          <option value="">—</option>
          <option value="MALE">ذكر</option>
          <option value="FEMALE">أنثى</option>
        </select>
      </div>
      <div>
        <label className="label-field">المدينة</label>
        <input name="city" className="input-field" defaultValue={b?.city ?? ""} />
      </div>
      <div>
        <label className="label-field">الحي</label>
        <input name="neighborhood" className="input-field" defaultValue={b?.neighborhood ?? ""} />
      </div>
      <div>
        <label className="label-field">تاريخ الميلاد</label>
        <input
          name="birthDate"
          type="date"
          className="input-field"
          dir="ltr"
          defaultValue={b?.birthDate ? b.birthDate.slice(0, 10) : ""}
        />
      </div>
      <div>
        <label className="label-field">عدد التابعين / حجم الأسرة</label>
        <input
          name="dependentsCount"
          type="text"
          inputMode="numeric"
          defaultValue={String(b?.dependentsCount ?? 0)}
          className="input-field"
          dir="ltr"
          onChange={(e) => {
            e.target.value = sanitizeNumericInput(e.target.value, false);
          }}
        />
      </div>
      <div>
        <label className="label-field">الجمعية</label>
        <select
          name="associationId"
          className="input-field"
          disabled={useOther}
          defaultValue={b?.associationId ?? ""}
          onChange={(e) => {
            if (e.target.value === "__other__") setUseOther(true);
          }}
        >
          <option value="">—</option>
          {associations.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
          <option value="__other__">أخرى</option>
        </select>
        {useOther ? (
          <input
            name="associationOther"
            className="input-field"
            style={{ marginTop: "0.5rem" }}
            placeholder="اسم الجمعية"
            defaultValue={b?.associationOther ?? ""}
            required
          />
        ) : null}
      </div>
      <div className="full">
        <label className="label-field">ملاحظات</label>
        <textarea name="notes" className="input-field" rows={2} defaultValue={b?.notes ?? ""} />
      </div>
    </div>
  );

  return (
    <div className="page-stack">
      <PageHeader
        title="المستفيدون"
        description={canManage ? "بحث وإضافة وتعديل واستيراد" : "بحث وعرض فقط"}
        actions={
          canManage ? (
            <>
              <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
                إضافة مستفيد
              </button>
              <button type="button" className="btn-secondary" onClick={() => setImportOpen(true)}>
                استيراد Excel
              </button>
            </>
          ) : null
        }
      />
      {msg ? <p className="msg">{msg}</p> : null}

      <section className="panel">
        <div className="toolbar">
          <input
            className="input-field"
            placeholder="الاسم / الهوية / الجوال"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void load(q);
              }
            }}
          />
          <button type="button" className="btn-primary" onClick={() => load(q)}>
            بحث
          </button>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">القائمة ({rows.length})</h2>
        <div className="table-wrap table-wrap--stack table-wrap--sticky-name">
          <table>
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الهوية</th>
                <th>الجوال</th>
                <th>عدد التابعين</th>
                <th>الجمعية</th>
                <th>الحالة</th>
                {canManage ? <th>إجراءات</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td data-label="الاسم">{r.name}</td>
                  <td data-label="الهوية" dir="ltr">
                    {r.nationalId}
                  </td>
                  <td data-label="الجوال" dir="ltr">
                    {r.mobile}
                  </td>
                  <td data-label="عدد التابعين">{r.dependentsCount ?? 0}</td>
                  <td data-label="الجمعية">
                    {r.association?.name ?? r.associationOther ?? "—"}
                  </td>
                  <td data-label="الحالة">
                    <span className="badge badge-muted">{r.statusLabel}</span>
                  </td>
                  {canManage ? (
                    <td data-label="إجراءات">
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => openEdit(r)}
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          className="btn-danger"
                          onClick={() => {
                            setDeleteConfirmText("");
                            setDeleting(r);
                          }}
                        >
                          حذف
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={canManage ? 7 : 6} className="empty">
                    لا توجد نتائج
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <Modal open={open} title="إضافة مستفيد" onClose={() => setOpen(false)} wide>
        <form onSubmit={onCreate}>
          {formFields(null)}
          <div className="form-actions">
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? "جاري الحفظ..." : "حفظ"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!editing}
        title={`تعديل بيانات: ${editing?.name ?? ""}`}
        onClose={() => {
          setEditing(null);
          setUseOther(false);
        }}
        wide
      >
        <form onSubmit={onEdit} key={editing?.id ?? "none"}>
          {formFields(editing)}
          <div className="form-actions">
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? "جاري الحفظ..." : "حفظ التعديلات"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!deleting}
        title={`حذف المستفيد: ${deleting?.name ?? ""}`}
        onClose={() => setDeleting(null)}
      >
        <p className="msg msg-error">
          تأكيد ثنائي: الحذف نهائي ولا يشمل من له حضور أو صرف مسجل. اكتب «حذف» ثم أكّد.
        </p>
        <input
          className="input-field"
          value={deleteConfirmText}
          onChange={(e) => setDeleteConfirmText(e.target.value)}
          placeholder="اكتب: حذف"
        />
        <div className="form-actions">
          <button
            type="button"
            className="btn-danger"
            disabled={busy || deleteConfirmText.trim() !== "حذف"}
            onClick={onDelete}
          >
            {busy ? "جاري الحذف..." : "تأكيد الحذف النهائي"}
          </button>
          <button type="button" className="btn-secondary" onClick={() => setDeleting(null)}>
            إلغاء
          </button>
        </div>
      </Modal>

      <Modal
        open={importOpen}
        title="استيراد Excel"
        onClose={() => {
          setImportOpen(false);
          setImportErrors([]);
        }}
      >
        <p className="page-header__desc" style={{ marginBottom: "0.75rem" }}>
          حمّل النموذج، عبّئه، ثم ارفعه. الهوية من 10 إلى 14 رقماً، والجوال
          05xxxxxxxx.
        </p>
        <div className="form-actions" style={{ marginBottom: "0.85rem" }}>
          <a className="btn-secondary" href="/api/beneficiaries/import/template">
            تحميل نموذج Excel
          </a>
        </div>
        <form onSubmit={onImport} className="toolbar">
          <input type="file" name="file" accept=".xlsx,.xls,.csv" required className="input-field" />
          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? "جاري..." : "رفع الملف"}
          </button>
        </form>
        {msg && importOpen ? (
          <p className={`msg ${importErrors.length && !msg.includes("ناجح") ? "msg-error" : ""}`} style={{ marginTop: "0.75rem" }}>
            {msg}
          </p>
        ) : null}
        {importErrors.length ? (
          <div className="msg msg-error" style={{ marginTop: "0.85rem" }}>
            <strong>أسباب الرفض / التجاوز:</strong>
            <ul style={{ margin: "0.5rem 0 0", paddingInlineStart: "1.25rem" }}>
              {importErrors.map((err, i) => (
                <li key={`${i}-${err.slice(0, 24)}`}>{err}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

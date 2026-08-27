"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/PageHeader";
import { Modal } from "@/components/Modal";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";
import { sanitizeNumericInput, toIntOrNull } from "@/lib/num";
import { PaginationBar } from "@/components/PaginationBar";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { FilterBar } from "@/components/ui/FilterBar";
import { Dropzone } from "@/components/ui/Dropzone";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ProfileDrawer } from "@/components/ui/ProfileDrawer";
import { STATUS_LABELS, type BeneficiaryExhibitionStatus } from "@/lib/status";

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
  const isAdmin = role === "ADMIN";

  const [q, setQ] = useState("");
  const [associationFilter, setAssociationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [rows, setRows] = useState<Beneficiary[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [associations, setAssociations] = useState<Association[]>([]);
  const [msg, setMsg] = useState("");
  const [useOther, setUseOther] = useState(false);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [editing, setEditing] = useState<Beneficiary | null>(null);
  const [deleting, setDeleting] = useState<Beneficiary | null>(null);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const toast = useToast();
  const drawerRow = rows.find((r) => r.id === drawerId) ?? null;

  async function load(
    search = q,
    p = page,
    assoc = associationFilter,
    status = statusFilter,
  ) {
    const qs = new URLSearchParams({
      page: String(p),
      pageSize: String(DEFAULT_PAGE_SIZE),
    });
    if (search.trim()) qs.set("q", search.trim());
    if (assoc) qs.set("associationId", assoc);
    if (status) qs.set("status", status);
    const res = await fetch(`/api/beneficiaries?${qs}`);
    const json = await res.json();
    if (res.ok) {
      setRows(json.data ?? []);
      setPage(json.page ?? p);
      setTotalPages(json.totalPages ?? 1);
      setTotal(json.total ?? 0);
    }
  }

  useEffect(() => {
    void load(q, 1);
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
    if (busy || !deleting) return;
    setBusy(true);
    setMsg("");
    const res = await fetch(`/api/beneficiaries/${deleting.id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? "تم حذف المستفيد" : json.error || "فشل الحذف");
    if (res.ok) {
      setDeleting(null);
      setDeleteStep(1);
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
        breadcrumb={[{ label: "الرئيسية", href: "/dashboard" }, { label: "المستفيدون" }]}
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
      {msg ? (
        <p className={`msg ${msg.includes("فشل") || msg.includes("غير") ? "msg-error" : ""}`}>
          {msg}
        </p>
      ) : null}

      <section className="panel">
        <FilterBar
          chips={[
            ...(q.trim() ? [{ key: "q", label: `بحث: ${q.trim()}` }] : []),
            ...(associationFilter
              ? [
                  {
                    key: "assoc",
                    label: `جمعية: ${
                      associationFilter === "__other__"
                        ? "أخرى"
                        : associationFilter === "__none__"
                          ? "بدون"
                          : associations.find((a) => a.id === associationFilter)?.name ?? "—"
                    }`,
                  },
                ]
              : []),
            ...(statusFilter
              ? [
                  {
                    key: "status",
                    label: `حالة: ${STATUS_LABELS[statusFilter as BeneficiaryExhibitionStatus] ?? statusFilter}`,
                  },
                ]
              : []),
          ]}
          onClear={
            q || associationFilter || statusFilter
              ? () => {
                  setQ("");
                  setAssociationFilter("");
                  setStatusFilter("");
                  void load("", 1, "", "");
                }
              : undefined
          }
        >
          <input
            className="input-field"
            placeholder="الاسم / الهوية / الجوال"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void load(q, 1);
              }
            }}
          />
          <select
            className="input-field"
            value={associationFilter}
            onChange={(e) => {
              const v = e.target.value;
              setAssociationFilter(v);
              void load(q, 1, v, statusFilter);
            }}
            aria-label="فلتر الجمعية"
          >
            <option value="">كل الجمعيات</option>
            <option value="__none__">بدون جمعية</option>
            {associations.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
            <option value="__other__">أخرى</option>
          </select>
          <select
            className="input-field"
            value={statusFilter}
            onChange={(e) => {
              const v = e.target.value;
              setStatusFilter(v);
              void load(q, 1, associationFilter, v);
            }}
            aria-label="فلتر الحالة"
          >
            <option value="">كل الحالات</option>
            {(Object.keys(STATUS_LABELS) as BeneficiaryExhibitionStatus[]).map((k) => (
              <option key={k} value={k}>
                {STATUS_LABELS[k]}
              </option>
            ))}
          </select>
          <button type="button" className="btn-primary btn-sm" onClick={() => void load(q, 1)}>
            بحث
          </button>
        </FilterBar>
      </section>

      <section className="panel">
        <h2 className="panel-title">القائمة ({total})</h2>
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
                  <td data-label="الاسم">
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => setDrawerId(r.id)}
                    >
                      {r.name}
                    </button>
                  </td>
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
                    <span className="badge badge-muted">{r.statusLabel ?? "—"}</span>
                  </td>
                  {canManage ? (
                    <td data-label="إجراءات">
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={() => openEdit(r)}
                        >
                          تعديل
                        </button>
                        {isAdmin ? (
                          <button
                            type="button"
                            className="btn-danger btn-sm"
                            onClick={() => {
                              setDeleteStep(1);
                              setDeleting(r);
                            }}
                          >
                            حذف
                          </button>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={canManage ? 7 : 6}>
                    <EmptyState title="لا توجد نتائج" body="جرّب تعديل كلمات البحث أو أضف مستفيداً جديداً." />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <PaginationBar
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={DEFAULT_PAGE_SIZE}
          busy={busy}
          onPageChange={(p) => void load(q, p)}
        />
      </section>

      <Modal
        open={open}
        title="إضافة مستفيد"
        onClose={() => {
          setOpen(false);
          setUseOther(false);
        }}
        wide
      >
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

      <ConfirmDialog
        open={!!deleting && deleteStep === 1}
        title={deleting ? `حذف المستفيد: ${deleting.name}` : "حذف مستفيد"}
        body="الحذف نهائي ويشمل السجلات المرتبطة (حضور، صرف، دعوات…). هل تريد المتابعة؟"
        destructive
        confirmLabel="متابعة"
        onClose={() => {
          setDeleting(null);
          setDeleteStep(1);
        }}
        onConfirm={() => setDeleteStep(2)}
      />
      <ConfirmDialog
        open={!!deleting && deleteStep === 2}
        title="تأكيد نهائي"
        body="سيتم حذف المستفيد وجميع بياناته المرتبطة. لا يمكن التراجع."
        destructive
        confirmLabel="نعم، احذف"
        busy={busy}
        onClose={() => {
          setDeleting(null);
          setDeleteStep(1);
        }}
        onConfirm={() => void onDelete()}
      />

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
          <Link className="btn-secondary" href="/api/beneficiaries/import/template">
            تحميل نموذج Excel
          </Link>
        </div>
        <form
          onSubmit={onImport}
          className="form-grid"
          onDragOver={(e) => e.preventDefault()}
        >
          <Dropzone
            accept=".xlsx,.xls,.csv"
            title="اسحب ملف Excel هنا أو اختر للتصفح"
            body="الصيغ: xlsx / xls / csv"
            onFiles={(files) => {
              const input = document.getElementById("beneficiary-import-file") as HTMLInputElement | null;
              if (!input) return;
              const dt = new DataTransfer();
              dt.items.add(files[0]);
              input.files = dt.files;
              toast.push({ title: "تم اختيار الملف", body: files[0]?.name, tone: "info" });
            }}
          />
          <input id="beneficiary-import-file" type="file" name="file" accept=".xlsx,.xls,.csv" required hidden />
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

      <ProfileDrawer
        open={!!drawerRow}
        title={drawerRow?.name ?? "بطاقة مستفيد"}
        onClose={() => setDrawerId(null)}
      >
        {drawerRow ? (
          <div className="form-grid">
            <div className="field-cell">
              <div className="field-cell-row">
                <span className="field-cell-label">الهوية</span>
                <span className="field-cell-value" dir="ltr">
                  {drawerRow.nationalId}
                </span>
              </div>
            </div>
            <div className="field-cell">
              <div className="field-cell-row">
                <span className="field-cell-label">الجوال</span>
                <span className="field-cell-value" dir="ltr">
                  {drawerRow.mobile}
                </span>
              </div>
            </div>
            <div className="field-cell">
              <div className="field-cell-row">
                <span className="field-cell-label">التابعون</span>
                <span className="field-cell-value">{drawerRow.dependentsCount ?? 0}</span>
              </div>
            </div>
            <div className="field-cell">
              <div className="field-cell-row">
                <span className="field-cell-label">الجمعية</span>
                <span className="field-cell-value">
                  {drawerRow.association?.name ?? drawerRow.associationOther ?? "—"}
                </span>
              </div>
            </div>
            {drawerRow.statusLabel ? (
              <span className="zad-badge zad-badge--brand">{drawerRow.statusLabel}</span>
            ) : null}
            {canManage ? (
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setDrawerId(null);
                  openEdit(drawerRow);
                }}
              >
                تعديل
              </button>
            ) : null}
          </div>
        ) : null}
      </ProfileDrawer>
    </div>
  );
}

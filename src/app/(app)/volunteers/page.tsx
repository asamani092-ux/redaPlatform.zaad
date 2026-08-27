"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dropzone } from "@/components/ui/Dropzone";

type TaskOpt = { id: string; name: string; active: boolean };
type VolunteerTask = { id: string; role: TaskOpt };
type Volunteer = {
  id: string;
  name: string;
  mobile: string;
  nationalId: string;
  volunteerTeam?: string | null;
  tasks: VolunteerTask[];
};

const emptyForm = {
  name: "",
  mobile: "",
  nationalId: "",
  volunteerTeam: "",
  taskIds: [] as string[],
};

function taskNames(volunteer: Volunteer): string {
  return volunteer.tasks.map((t) => t.role.name).join("، ") || "—";
}

/**
 * إدارة متطوعي المعرض النشط.
 * Time: O(n) للعرض؛ الإضافة O(t) حيث t عدد المهام.
 */
export default function VolunteersPage() {
  const [rows, setRows] = useState<Volunteer[]>([]);
  const [tasks, setTasks] = useState<TaskOpt[]>([]);
  const [msg, setMsg] = useState("");
  const [msgError, setMsgError] = useState(false);
  const [formMsg, setFormMsg] = useState("");
  const [formMsgError, setFormMsgError] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [importOpen, setImportOpen] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [importMsgError, setImportMsgError] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  function showPageMsg(text: string, isError = false) {
    setMsg(text);
    setMsgError(isError);
  }

  function showFormMsg(text: string, isError = false) {
    setFormMsg(text);
    setFormMsgError(isError);
  }

  async function load() {
    const [vRes, tRes] = await Promise.all([
      fetch("/api/volunteers"),
      fetch("/api/volunteer-roles?active=1"),
    ]);
    const vJson = await vRes.json().catch(() => ({}));
    const tJson = await tRes.json().catch(() => ({}));
    if (vRes.ok) setRows(vJson.data ?? []);
    else showPageMsg(vJson.error || "تعذر تحميل المتطوعين", true);
    if (tRes.ok) {
      const list = (tJson.data ?? []) as TaskOpt[];
      setTasks(list);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function resetForm() {
    setForm(emptyForm);
  }

  function toggleTask(taskId: string) {
    setForm((f) => ({
      ...f,
      taskIds: f.taskIds.includes(taskId)
        ? f.taskIds.filter((id) => id !== taskId)
        : [...f.taskIds, taskId],
    }));
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!form.taskIds.length) {
      showFormMsg("اختر مهمة واحدة على الأقل", true);
      return;
    }
    setBusy(true);
    showFormMsg("");
    try {
      const res = await fetch("/api/volunteers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = json.error || "فشل الحفظ";
        showFormMsg(err, true);
        if (res.status === 401) {
          window.location.href = "/login?callbackUrl=/volunteers";
        }
        return;
      }

      resetForm();
      setOpen(false);
      showFormMsg("");
      showPageMsg("تمت إضافة المتطوع");
      await load();
    } catch {
      showFormMsg("تعذر الاتصال بالخادم — حاول مجدداً", true);
    } finally {
      setBusy(false);
    }
  }

  async function removeVolunteer() {
    if (!deleteTarget || busy) return;
    setBusy(true);
    const res = await fetch(`/api/volunteers?id=${encodeURIComponent(deleteTarget.id)}`, {
      method: "DELETE",
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    setDeleteTarget(null);
    setDeleteStep(1);
    showPageMsg(res.ok ? "تم الحذف" : json.error || "فشل الحذف", !res.ok);
    if (res.ok) await load();
  }

  async function onImport(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setImportErrors([]);
    setImportMsg("");
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/volunteers/import", { method: "POST", body: fd });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    const errs: string[] = Array.isArray(json.errors) ? json.errors : [];
    setImportErrors(errs);
    const created = Number(json.created ?? 0);
    const skipped = Number(json.skipped ?? 0);
    if (!res.ok) {
      setImportMsgError(true);
      setImportMsg(json.error || json.message || "فشل الاستيراد");
      return;
    }
    setImportMsgError(created === 0);
    setImportMsg(json.message || `استيراد: ${created} ناجح / ${skipped} متجاوز`);
    if (created > 0) {
      await load();
      if (errs.length === 0) setImportOpen(false);
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="المتطوعون"
        description="تسجيل متطوعي المعرض: الاسم، الجوال، الهوية، والمهام (متعددة)"
        actions={
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn-secondary"
              disabled={!tasks.length}
              title={!tasks.length ? "أضف مهام المتطوعين من الإعدادات أولاً" : undefined}
              onClick={() => {
                setImportErrors([]);
                setImportMsg("");
                setImportOpen(true);
              }}
            >
              استيراد Excel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!tasks.length}
              title={!tasks.length ? "أضف مهام المتطوعين من الإعدادات أولاً" : undefined}
              onClick={() => {
                showPageMsg("");
                showFormMsg("");
                resetForm();
                setOpen(true);
              }}
            >
              إضافة متطوع
            </button>
          </div>
        }
      />
      {msg ? <p className={`msg${msgError ? " msg-error" : ""}`}>{msg}</p> : null}

      <section className="panel">
        <h2 className="panel-title">قائمة المتطوعين ({rows.length})</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الهوية</th>
                <th>الجوال</th>
                <th>الفريق التطوعي</th>
                <th>المهام</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td dir="ltr">{r.nationalId}</td>
                  <td dir="ltr">{r.mobile}</td>
                  <td>{r.volunteerTeam?.trim() || "—"}</td>
                  <td>{taskNames(r)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setDeleteStep(1);
                        setDeleteTarget({ id: r.id, name: r.name });
                      }}
                    >
                      حذف
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={6} className="empty">
                    لا متطوعين بعد — اضغط «إضافة متطوع» للبدء
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={open}
        title="إضافة متطوع"
        wide
        onClose={() => {
          if (busy) return;
          setOpen(false);
          resetForm();
        }}
      >
        {!tasks.length ? (
          <p className="page-header__desc">
            لا توجد مهام نشطة — أضف مهام المتطوعين من الإعدادات أولاً.
          </p>
        ) : (
          <form onSubmit={onCreate} className="form-grid">
            {formMsg ? (
              <p className={`msg full${formMsgError ? " msg-error" : ""}`}>{formMsg}</p>
            ) : null}
            <div>
              <label className="label-field">اسم المتطوع</label>
              <input
                className="input-field"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="label-field">رقم الجوال</label>
              <input
                className="input-field"
                required
                dir="ltr"
                inputMode="tel"
                value={form.mobile}
                onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
              />
            </div>
            <div>
              <label className="label-field">رقم الهوية</label>
              <input
                className="input-field"
                required
                dir="ltr"
                inputMode="numeric"
                minLength={10}
                maxLength={14}
                value={form.nationalId}
                onChange={(e) => setForm((f) => ({ ...f, nationalId: e.target.value }))}
              />
            </div>
            <div>
              <label className="label-field">الفريق التطوعي (اختياري)</label>
              <input
                className="input-field"
                value={form.volunteerTeam}
                onChange={(e) => setForm((f) => ({ ...f, volunteerTeam: e.target.value }))}
              />
            </div>
            <div className="full">
              <label className="label-field">المهام (اختر واحدة أو أكثر)</label>
              <div
                className="form-grid"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(11rem, 1fr))", gap: "0.5rem" }}
              >
                {tasks.map((t) => (
                  <label
                    key={t.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.45rem",
                      padding: "0.45rem 0.55rem",
                      border: "1px solid var(--tmkeen-surface-border)",
                      borderRadius: "var(--radius-sm)",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={form.taskIds.includes(t.id)}
                      onChange={() => toggleTask(t.id)}
                    />
                    <span>{t.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="form-actions full">
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
              >
                إلغاء
              </button>
              <button className="btn-primary" type="submit" disabled={busy}>
                {busy ? "جاري…" : "حفظ المتطوع"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={importOpen}
        title="استيراد المتطوعين من Excel"
        onClose={() => {
          setImportOpen(false);
          setImportErrors([]);
          setImportMsg("");
        }}
      >
        <p className="page-header__desc" style={{ marginBottom: "0.75rem" }}>
          حمّل النموذج، عبّئه، ثم ارفعه. الهوية من 10 إلى 14 رقماً، الجوال
          05xxxxxxxx، والمهام مفصولة بفاصلة. المتطوعون يُضافون للمعرض النشط.
        </p>
        <div className="form-actions" style={{ marginBottom: "0.85rem" }}>
          <Link className="btn-secondary" href="/api/volunteers/import/template">
            تحميل نموذج Excel
          </Link>
        </div>
        <form onSubmit={onImport} className="form-grid" onDragOver={(e) => e.preventDefault()}>
          <Dropzone
            accept=".xlsx,.xls,.csv"
            title="اسحب ملف Excel هنا أو اختر للتصفح"
            body="الصيغ: xlsx / xls / csv"
            onFiles={(files) => {
              const input = document.getElementById("volunteer-import-file") as HTMLInputElement | null;
              if (!input || !files.length) return;
              const dt = new DataTransfer();
              dt.items.add(files[0]);
              input.files = dt.files;
              showPageMsg("");
              setImportMsg(`تم اختيار الملف: ${files[0]?.name ?? ""}`);
              setImportMsgError(false);
            }}
          />
          <input
            id="volunteer-import-file"
            type="file"
            name="file"
            accept=".xlsx,.xls,.csv"
            required
            hidden
          />
          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? "جاري..." : "رفع الملف"}
          </button>
        </form>
        {importMsg ? (
          <p className={`msg${importMsgError ? " msg-error" : ""}`} style={{ marginTop: "0.75rem" }}>
            {importMsg}
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

      <ConfirmDialog
        open={!!deleteTarget && deleteStep === 1}
        title={deleteTarget ? `حذف المتطوع: ${deleteTarget.name}` : "حذف متطوع"}
        body="هل تريد حذف سجل المتطوع؟"
        destructive
        confirmLabel="متابعة"
        onClose={() => {
          setDeleteTarget(null);
          setDeleteStep(1);
        }}
        onConfirm={() => setDeleteStep(2)}
      />
      <ConfirmDialog
        open={!!deleteTarget && deleteStep === 2}
        title="تأكيد نهائي"
        body="سيتم حذف السجل نهائياً ولا يمكن التراجع."
        destructive
        confirmLabel="نعم، احذف"
        busy={busy}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteStep(1);
        }}
        onConfirm={() => void removeVolunteer()}
      />
    </div>
  );
}

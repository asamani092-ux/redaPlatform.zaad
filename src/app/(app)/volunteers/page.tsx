"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Modal } from "@/components/Modal";

type TaskOpt = { id: string; name: string; active: boolean };
type VolunteerTask = { id: string; role: TaskOpt };
type Volunteer = {
  id: string;
  name: string;
  mobile: string;
  nationalId: string;
  thanksSentAt: string | null;
  tasks: VolunteerTask[];
};

const emptyForm = {
  name: "",
  mobile: "",
  nationalId: "",
  taskIds: [] as string[],
  sendThanks: true,
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

      const thanksFailed =
        form.sendThanks &&
        json.thanksStatus &&
        json.thanksStatus !== "SENT" &&
        json.thanksStatus !== "STUBBED";
      const thanksNote = form.sendThanks
        ? thanksFailed
          ? ` — فشل واتساب: ${json.thanksError || json.thanksStatus}`
          : ` — واتساب: ${json.thanksStatus || "تم"}`
        : "";

      resetForm();
      setOpen(false);
      showFormMsg("");
      showPageMsg(
        thanksFailed
          ? `تمت إضافة المتطوع${thanksNote}`
          : form.sendThanks
            ? `تمت الإضافة${thanksNote}`
            : "تمت إضافة المتطوع",
        thanksFailed,
      );
      await load();
    } catch {
      showFormMsg("تعذر الاتصال بالخادم — حاول مجدداً", true);
    } finally {
      setBusy(false);
    }
  }

  async function sendThanks(id: string) {
    if (busy) return;
    setBusy(true);
    showPageMsg("");
    try {
      const res = await fetch("/api/volunteers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, sendThanks: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showPageMsg(json.error || "فشل", true);
        return;
      }
      const failed =
        json.thanksStatus &&
        json.thanksStatus !== "SENT" &&
        json.thanksStatus !== "STUBBED";
      showPageMsg(
        failed
          ? `فشل إرسال الشكر: ${json.thanksError || json.thanksStatus}`
          : `تم إرسال الشكر (${json.thanksStatus ?? "ok"})`,
        failed,
      );
      await load();
    } catch {
      showPageMsg("تعذر الاتصال بالخادم", true);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`حذف المتطوع «${name}»؟`)) return;
    if (!window.confirm("تأكيد نهائي: سيتم حذف السجل.")) return;
    const res = await fetch(`/api/volunteers?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const json = await res.json().catch(() => ({}));
    showPageMsg(res.ok ? "تم الحذف" : json.error || "فشل الحذف", !res.ok);
    if (res.ok) await load();
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="المتطوعون"
        description="تسجيل متطوعي المعرض: الاسم، الجوال، الهوية، والمهام (متعددة)"
        actions={
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
                <th>المهام</th>
                <th>الشكر</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td dir="ltr">{r.nationalId}</td>
                  <td dir="ltr">{r.mobile}</td>
                  <td>{taskNames(r)}</td>
                  <td>{r.thanksSentAt ? "أُرسل" : "—"}</td>
                  <td>
                    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={busy}
                        onClick={() => void sendThanks(r.id)}
                      >
                        شكر واتساب
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => void remove(r.id, r.name)}
                      >
                        حذف
                      </button>
                    </div>
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
            <div className="full" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                id="sendThanks"
                type="checkbox"
                checked={form.sendThanks}
                onChange={(e) => setForm((f) => ({ ...f, sendThanks: e.target.checked }))}
              />
              <label htmlFor="sendThanks" className="label-field" style={{ margin: 0 }}>
                إرسال رسالة شكر عبر واتساب عند الحفظ
              </label>
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
    </div>
  );
}

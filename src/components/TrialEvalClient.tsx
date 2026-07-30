"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import {
  TRIAL_EVAL_RATINGS,
  buildTrialEvalReport,
  getTrialEvalTools,
  type TrialEvalRating,
} from "@/lib/trial-eval-tools";

const STORAGE_KEY = "ridaa-trial-eval-v1";

type RowState = {
  rating: TrialEvalRating;
  note: string;
};

/** زمن التحديث O(1) لكل صف؛ نسخ التقرير O(n) */
export function TrialEvalClient() {
  const tools = useMemo(() => getTrialEvalTools(), []);
  const [state, setState] = useState<Record<string, RowState>>({});
  const [copied, setCopied] = useState("");
  const [reportText, setReportText] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState(JSON.parse(raw) as Record<string, RowState>);
    } catch {
      /* تجاهل تخزين تالف */
    }
  }, []);

  useEffect(() => {
    if (!Object.keys(state).length) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  function ratingFor(path: string): TrialEvalRating {
    return state[path]?.rating ?? "غير مجرّب";
  }

  function setRating(path: string, rating: TrialEvalRating) {
    setState((prev) => ({
      ...prev,
      [path]: { rating, note: prev[path]?.note ?? "" },
    }));
  }

  function setNote(path: string, note: string) {
    setState((prev) => ({
      ...prev,
      [path]: { rating: prev[path]?.rating ?? "غير مجرّب", note },
    }));
  }

  async function copyReport() {
    const rows = tools.map((t) => ({
      ...t,
      rating: ratingFor(t.path),
      note: state[t.path]?.note,
    }));
    const text = buildTrialEvalReport(rows);
    setReportText(text);
    try {
      await navigator.clipboard.writeText(text);
      setCopied("تم نسخ التقرير كاملاً — يمكن لصقه لمراجعة الإصلاحات");
    } catch {
      setCopied("تعذر النسخ التلقائي — حدد النص من المربع أدناه وانسخه يدوياً");
      const el = document.getElementById("trial-eval-report") as HTMLTextAreaElement | null;
      if (el) {
        el.focus();
        el.select();
      }
    }
  }

  const summary = TRIAL_EVAL_RATINGS.map((label) => ({
    label,
    count: tools.filter((t) => ratingFor(t.path) === label).length,
  }));

  return (
    <div className="page-stack">
      <PageHeader
        title="تقييم أدوات التجربة"
        description="قائمة مستخرجة من التنقل والمسارات الفعلية — للتقييم قبل الإطلاق ثم تُحذف الصفحة"
        actions={
          <button type="button" className="btn-primary" onClick={() => void copyReport()}>
            نسخ التقرير كاملاً
          </button>
        }
      />

      <section className="panel">
        <h2 className="panel-title">ما تبقّى قبل بدء التجربة على السيرفر</h2>
        <ol style={{ margin: 0, paddingInlineStart: "1.25rem", display: "grid", gap: "0.45rem" }}>
          <li>ضبط خدمة النشر على جذر المشروع (بدون مجلد فرعي قديم) وإعادة النشر من الفرع الرئيسي.</li>
          <li>
            تعبئة متغيرات التشغيل: رابط قاعدة البيانات، سر الجلسة، رابط الموقع العام، وتفعيل مضيف موثوق؛ وتغيير كلمة مرور المدير الافتراضية.
          </li>
          <li>تفعيل هذه الصفحة في بيئة التجربة فقط عبر المتغير المخصص، وإيقافه أو حذف مسار الصفحة قبل الإطلاق النهائي.</li>
          <li>
            بعد الدخول بحساب المدير: إنشاء مستخدمي الأدوار، ضبط إعدادات المعرض والمخزون، استيراد المستفيدين، إرسال الدعوات، ثم مسار التشغيل (حضور ثم صرف).
          </li>
          <li>رسائل واتساب ما زالت تجريبية (تسجيل داخلي بلا إرسال حقيقي) — مقبول لفترة التجربة.</li>
        </ol>
      </section>

      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        {summary.map((s) => (
          <div key={s.label} className="stat-tile">
            <div className="value">{s.count}</div>
            <div className="label">{s.label}</div>
          </div>
        ))}
      </div>

      {copied ? <p className="msg">{copied}</p> : null}

      <section className="panel">
        <h2 className="panel-title">قائمة الأدوات ({tools.length})</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>الأداة</th>
                <th>المسار</th>
                <th>ما يُتحقق منه</th>
                <th>التقييم</th>
                <th>ملاحظة</th>
              </tr>
            </thead>
            <tbody>
              {tools.map((t) => (
                <tr key={t.path}>
                  <td>
                    <strong>{t.tool}</strong>
                  </td>
                  <td>
                    <Link href={t.path} className="mono" dir="ltr">
                      {t.path}
                    </Link>
                  </td>
                  <td style={{ minWidth: 220 }}>{t.verify}</td>
                  <td style={{ minWidth: 140 }}>
                    <select
                      className="input-field"
                      value={ratingFor(t.path)}
                      onChange={(e) => setRating(t.path, e.target.value as TrialEvalRating)}
                    >
                      {TRIAL_EVAL_RATINGS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ minWidth: 160 }}>
                    <input
                      className="input-field"
                      placeholder="ملاحظة إصلاح"
                      value={state[t.path]?.note ?? ""}
                      onChange={(e) => setNote(t.path, e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">نص التقرير (للنسخ اليدوي إن لزم)</h2>
        <textarea
          id="trial-eval-report"
          className="input-field"
          rows={8}
          readOnly
          dir="rtl"
          value={reportText}
          placeholder="يظهر هنا بعد الضغط على «نسخ التقرير كاملاً»"
        />
      </section>
    </div>
  );
}

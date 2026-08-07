"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { Accordion } from "@/components/ui/Accordion";
import { useToast } from "@/components/ui/Toast";
import {
  TRIAL_EVAL_RATINGS,
  buildTrialEvalReport,
  getTrialEvalTools,
  type TrialEvalRating,
} from "@/lib/trial-eval-tools";

const STORAGE_KEY = "ridaa-trial-eval-v2";

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
  const toast = useToast();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setState(JSON.parse(raw) as Record<string, RowState>);
        return;
      }
      // تراكمي: دمج تقييمات v1 إن وُجدت
      const legacy = localStorage.getItem("ridaa-trial-eval-v1");
      if (legacy) {
        const old = JSON.parse(legacy) as Record<string, RowState>;
        const migrated: Record<string, RowState> = {};
        for (const t of getTrialEvalTools()) {
          if (old[t.path]) migrated[t.id] = old[t.path]!;
          else if (old[t.id]) migrated[t.id] = old[t.id]!;
        }
        setState(migrated);
      }
    } catch {
      /* تجاهل تخزين تالف */
    }
  }, []);

  useEffect(() => {
    if (!Object.keys(state).length) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  function ratingFor(id: string): TrialEvalRating {
    return state[id]?.rating ?? "غير مجرّب";
  }

  function setRating(id: string, rating: TrialEvalRating) {
    setState((prev) => ({
      ...prev,
      [id]: { rating, note: prev[id]?.note ?? "" },
    }));
  }

  function setNote(id: string, note: string) {
    setState((prev) => ({
      ...prev,
      [id]: { rating: prev[id]?.rating ?? "غير مجرّب", note },
    }));
  }

  async function copyReport() {
    const rows = tools.map((t) => ({
      ...t,
      rating: ratingFor(t.id),
      note: state[t.id]?.note,
    }));
    const text = buildTrialEvalReport(rows);
    setReportText(text);
    try {
      await navigator.clipboard.writeText(text);
      setCopied("تم نسخ التقرير كاملاً — يمكن لصقه لمراجعة الإصلاحات");
      toast.push({ title: "تم نسخ التقرير", tone: "success" });
    } catch {
      setCopied("تعذر النسخ التلقائي — حدد النص من المربع أدناه وانسخه يدوياً");
      toast.push({ title: "تعذر النسخ التلقائي", tone: "warning" });
      const el = document.getElementById("trial-eval-report") as HTMLTextAreaElement | null;
      if (el) {
        el.focus();
        el.select();
      }
    }
  }

  const summary = TRIAL_EVAL_RATINGS.map((label) => ({
    label,
    count: tools.filter((t) => ratingFor(t.id) === label).length,
  }));

  return (
    <div className="page-stack">
      <PageHeader
        title="تقييم أدوات التجربة"
        description="كل أدوات التشغيل والشاشات الجديدة للتقييم قبل النشر — تُحذف الصفحة بعد الإطلاق"
        breadcrumb={[{ label: "الرئيسية", href: "/dashboard" }, { label: "تقييم التجربة" }]}
        actions={
          <button type="button" className="btn-primary" onClick={() => void copyReport()}>
            نسخ التقرير كاملاً
          </button>
        }
      />

      <section className="panel">
        <h2 className="panel-title">ما تبقّى قبل بدء التجربة على السيرفر</h2>
        <Accordion
          items={[
            {
              id: "deploy",
              title: "النشر والمتغيرات",
              body: "ضبط خدمة النشر على جذر المشروع، وملء رابط قاعدة البيانات وسر الجلسة ورابط الموقع العام، وتغيير كلمة مرور المدير الافتراضية.",
            },
            {
              id: "trial",
              title: "مسار التجربة",
              body: "تفعيل الصفحة في بيئة التجربة فقط، ثم إنشاء المستخدمين وضبط المعرض والمخزون واستيراد المستفيدين ومسار الحضور/الصرف.",
            },
            {
              id: "wa",
              title: "واتساب",
              body: "رسائل واتساب ما زالت تجريبية (تسجيل داخلي بلا إرسال حقيقي) — مقبول لفترة التجربة.",
            },
          ]}
        />
      </section>

      <div className="stat-grid">
        {summary.map((s) => (
          <KpiCard key={s.label} label={s.label} value={s.count} />
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
              {tools.map((t) => {
                const href = t.path.split("#")[0] || t.path;
                return (
                <tr key={t.id}>
                  <td>
                    <strong>{t.tool}</strong>
                  </td>
                  <td>
                    <Link href={href} className="mono" dir="ltr">
                      {t.path}
                    </Link>
                  </td>
                  <td>{t.verify}</td>
                  <td>
                    <select
                      className="input-field"
                      value={ratingFor(t.id)}
                      onChange={(e) => setRating(t.id, e.target.value as TrialEvalRating)}
                    >
                      {TRIAL_EVAL_RATINGS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className="input-field"
                      placeholder="ملاحظة إصلاح"
                      value={state[t.id]?.note ?? ""}
                      onChange={(e) => setNote(t.id, e.target.value)}
                    />
                  </td>
                </tr>
              );
              })}
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

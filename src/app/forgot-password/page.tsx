"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Stepper } from "@/components/ui/Stepper";

/**
 * نسيت كلمة المرور: إدخال الجوال ثم فتح نموذج التغيير مباشرة.
 * Time: O(1) لكل طلب.
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestCode(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    setMsg("");
    const res = await fetch("/api/password/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.error || "تعذر الإرسال");
      return;
    }
    setMsg(json.message);
    if (json.trialCode) setCode(String(json.trialCode));
    // فتح شاشة تعديل كلمة المرور مباشرة بعد إدخال الجوال
    setStep(2);
  }

  async function resetPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    const confirm = String(fd.get("confirm") ?? "");
    if (password !== confirm) {
      setError("كلمتا المرور غير متطابقتين");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch("/api/password/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile, code: code || String(fd.get("code") ?? ""), password }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.error || "تعذر التغيير");
      return;
    }
    setMsg(json.message);
    setTimeout(() => router.replace("/login"), 1200);
  }

  return (
    <div className="login-screen page-shell">
      <div className="login-card card page-container-narrow">
        <div className="login-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.webp" alt="رداء" width={80} height={80} />
          <h1>استعادة كلمة المرور</h1>
          <p>أدخل الجوال ثم عدّل كلمة المرور مباشرة بعد رمز التحقق</p>
        </div>

        <Stepper
          steps={[
            { id: "mobile", label: "الجوال" },
            { id: "reset", label: "كلمة المرور" },
          ]}
          currentId={step === 1 ? "mobile" : "reset"}
        />

        {msg ? <p className="msg">{msg}</p> : null}
        {error ? <p className="msg msg-error">{error}</p> : null}

        {step === 1 ? (
          <form onSubmit={requestCode} className="login-form" method="post" action="#">
            <div>
              <label className="label-field" htmlFor="mobile">
                رقم الجوال
              </label>
              <input
                id="mobile"
                className="input-field"
                dir="ltr"
                inputMode="tel"
                required
                placeholder="05xxxxxxxx"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary" style={{ width: "100%" }} disabled={loading}>
              {loading ? "جاري…" : "متابعة لتعديل كلمة المرور"}
            </button>
            <Link href="/login" className="btn-secondary" style={{ width: "100%", textAlign: "center" }}>
              العودة للدخول
            </Link>
          </form>
        ) : (
          <form onSubmit={resetPassword} className="login-form" method="post" action="#">
            <div>
              <label className="label-field" htmlFor="code">
                رمز التحقق
              </label>
              <input
                id="code"
                name="code"
                className="input-field"
                dir="ltr"
                inputMode="numeric"
                required
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <div>
              <label className="label-field" htmlFor="password">
                كلمة المرور الجديدة
              </label>
              <input
                id="password"
                name="password"
                type="password"
                className="input-field"
                dir="ltr"
                minLength={8}
                required
              />
            </div>
            <div>
              <label className="label-field" htmlFor="confirm">
                تأكيد كلمة المرور
              </label>
              <input
                id="confirm"
                name="confirm"
                type="password"
                className="input-field"
                dir="ltr"
                minLength={8}
                required
              />
            </div>
            <button type="submit" className="btn-primary" style={{ width: "100%" }} disabled={loading}>
              {loading ? "جاري التغيير..." : "تغيير كلمة المرور"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ width: "100%" }}
              onClick={() => setStep(1)}
            >
              تغيير رقم الجوال / إعادة الإرسال
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

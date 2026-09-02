"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Stepper } from "@/components/ui/Stepper";
import { PasswordField } from "@/components/PasswordField";

type FlowStep = "mobile" | "waiting" | "password" | "expired";

/**
 * نسيت كلمة المرور: طلب → انتظار موافقة المدير (5 دقائق) → تعيين كلمة المرور.
 * Time: O(1) لكل طلب؛ polling كل 3 ثوانٍ.
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<FlowStep>("mobile");
  const [mobile, setMobile] = useState("");
  const [requestId, setRequestId] = useState("");
  const [expiresInSec, setExpiresInSec] = useState(300);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const expiresAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (step !== "waiting" && step !== "password") return;
    if (!requestId) return;

    let cancelled = false;
    const tick = async () => {
      const res = await fetch(
        `/api/password/forgot/status?requestId=${encodeURIComponent(requestId)}`,
      );
      const json = await res.json().catch(() => ({}));
      if (cancelled) return;
      const status = String(json.status ?? "EXPIRED");
      if (json.expiresAt) {
        const t = new Date(json.expiresAt).getTime();
        expiresAtRef.current = t;
        setExpiresInSec(Math.max(0, Math.floor((t - Date.now()) / 1000)));
      }
      if (status === "APPROVED") {
        setStep("password");
        setMsg("وافق المدير — عيّن كلمة المرور الجديدة الآن");
        setError("");
        return;
      }
      if (status === "EXPIRED" || status === "USED") {
        setStep("expired");
        setError(
          status === "USED"
            ? "تم استخدام هذا الطلب مسبقاً"
            : "انتهت مدة الطلب (5 دقائق) — أعد الطلب وبلّغ المدير",
        );
        setMsg("");
      }
    };

    void tick();
    const poll = window.setInterval(() => void tick(), 3000);
    const countdown = window.setInterval(() => {
      if (!expiresAtRef.current) return;
      const left = Math.max(0, Math.floor((expiresAtRef.current - Date.now()) / 1000));
      setExpiresInSec(left);
      if (left <= 0 && step === "waiting") {
        setStep("expired");
        setError("انتهت مدة الطلب (5 دقائق) — أعد الطلب وبلّغ المدير");
      }
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      window.clearInterval(countdown);
    };
  }, [step, requestId]);

  async function requestReset(e: FormEvent) {
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
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(json.error || "تعذر الإرسال");
      return;
    }
    const id = String(json.requestId ?? "");
    if (!id) {
      setError("تعذر إنشاء الطلب");
      return;
    }
    setRequestId(id);
    const sec = Number(json.expiresInSec ?? 300);
    setExpiresInSec(sec);
    expiresAtRef.current = Date.now() + sec * 1000;
    setMsg(json.message || "بلّغ المدير خلال 5 دقائق للموافقة");
    setStep("waiting");
  }

  async function resetPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading || !requestId) return;
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
      body: JSON.stringify({ requestId, password }),
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(json.error || "تعذر التغيير");
      return;
    }
    setMsg(json.message || "تم التغيير");
    setTimeout(() => router.replace("/login"), 1200);
  }

  function restart() {
    setStep("mobile");
    setRequestId("");
    setExpiresInSec(300);
    expiresAtRef.current = null;
    setError("");
    setMsg("");
  }

  const stepperId =
    step === "mobile" ? "mobile" : step === "password" ? "reset" : "wait";

  return (
    <div className="login-screen page-shell">
      <div className="login-card card page-container-narrow">
        <div className="login-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="login-brand__poster"
            src="/invite-poster.jpg"
            alt="معرض رداء للأقمشة"
            width={160}
            height={160}
          />
          <h1>استعادة كلمة المرور</h1>
          <p>اطلب الاستعادة ثم اطلب من المدير الموافقة خلال 5 دقائق</p>
        </div>

        <Stepper
          steps={[
            { id: "mobile", label: "الجوال" },
            { id: "wait", label: "موافقة المدير" },
            { id: "reset", label: "كلمة المرور" },
          ]}
          currentId={stepperId}
        />

        {msg ? <p className="msg">{msg}</p> : null}
        {error ? <p className="msg msg-error">{error}</p> : null}

        {step === "mobile" ? (
          <form onSubmit={requestReset} className="login-form" method="post" action="#">
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
              {loading ? "جاري…" : "إرسال طلب الاستعادة"}
            </button>
            <Link href="/login" className="btn-secondary" style={{ width: "100%", textAlign: "center" }}>
              العودة للدخول
            </Link>
          </form>
        ) : null}

        {step === "waiting" ? (
          <div className="login-form">
            <p className="page-header__desc">
              بانتظار موافقة المدير… المتبقي{" "}
              <strong dir="ltr">
                {Math.floor(expiresInSec / 60)}:{String(expiresInSec % 60).padStart(2, "0")}
              </strong>
            </p>
            <p className="page-header__desc">بلّغ المدير الآن من شاشة المستخدمين → طلبات الاستعادة.</p>
            <button type="button" className="btn-secondary" style={{ width: "100%" }} onClick={restart}>
              إلغاء / طلب جديد
            </button>
          </div>
        ) : null}

        {step === "password" ? (
          <form onSubmit={resetPassword} className="login-form" method="post" action="#">
            <p className="page-header__desc">
              المتبقي للتعيين:{" "}
              <strong dir="ltr">
                {Math.floor(expiresInSec / 60)}:{String(expiresInSec % 60).padStart(2, "0")}
              </strong>
            </p>
            <div>
              <label className="label-field" htmlFor="password">
                كلمة المرور الجديدة
              </label>
              <PasswordField
                id="password"
                name="password"
                minLength={8}
                required
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="label-field" htmlFor="confirm">
                تأكيد كلمة المرور
              </label>
              <PasswordField
                id="confirm"
                name="confirm"
                minLength={8}
                required
                autoComplete="new-password"
              />
            </div>
            <button type="submit" className="btn-primary" style={{ width: "100%" }} disabled={loading}>
              {loading ? "جاري التغيير..." : "تغيير كلمة المرور"}
            </button>
            <button type="button" className="btn-secondary" style={{ width: "100%" }} onClick={restart}>
              بدء من جديد
            </button>
          </form>
        ) : null}

        {step === "expired" ? (
          <div className="login-form">
            <button type="button" className="btn-primary" style={{ width: "100%" }} onClick={restart}>
              طلب استعادة جديد
            </button>
            <Link href="/login" className="btn-secondary" style={{ width: "100%", textAlign: "center" }}>
              العودة للدخول
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

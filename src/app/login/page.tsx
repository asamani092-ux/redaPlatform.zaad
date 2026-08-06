"use client";

import { FormEvent, useState, Suspense } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      mobile: String(fd.get("mobile") ?? ""),
      password: String(fd.get("password") ?? ""),
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("بيانات الدخول غير صحيحة");
      return;
    }
    router.replace(search.get("callbackUrl") || "/");
    router.refresh();
  }

  return (
    <div className="login-screen page-shell">
      <div className="login-card card page-container-narrow">
        <div className="login-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.webp" alt="رداء" width={80} height={80} />
          <h1>منصة رداء</h1>
          <p>دخول الموظفين بالجوال وكلمة المرور</p>
        </div>
        <form onSubmit={onSubmit} className="login-form" method="post" action="#">
          <div>
            <label className="label-field" htmlFor="mobile">
              رقم الجوال
            </label>
            <input
              id="mobile"
              name="mobile"
              className="input-field"
              dir="ltr"
              inputMode="tel"
              required
              placeholder="05xxxxxxxx"
            />
          </div>
          <div>
            <label className="label-field" htmlFor="password">
              كلمة المرور
            </label>
            <input id="password" name="password" type="password" className="input-field" dir="ltr" required />
          </div>
          {error ? <p className="msg msg-error" role="alert">{error}</p> : null}
          <button type="submit" className="btn-primary" style={{ width: "100%" }} disabled={loading} aria-busy={loading}>
            {loading ? "جاري الدخول..." : "دخول"}
          </button>
          <Link
            href="/forgot-password"
            style={{
              textAlign: "center",
              display: "block",
              marginTop: "var(--space-2)",
              fontSize: "var(--text-sm)",
              color: "var(--text-link)",
            }}
          >
            نسيت كلمة المرور؟
          </Link>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="login-screen">تحميل...</div>}>
      <LoginForm />
    </Suspense>
  );
}

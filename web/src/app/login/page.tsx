"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

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
    router.replace(search.get("callbackUrl") || "/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md panel shadow-sm">
        <div className="flex flex-col items-center gap-3 mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.webp" alt="رداء" width={72} height={72} />
          <h1 className="text-3xl font-extrabold text-primary">منصة رداء</h1>
          <p className="text-sm text-center">دخول الموظفين بالجوال وكلمة المرور</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
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
          {error ? <p className="text-sm text-[var(--tmkeen-danger)]">{error}</p> : null}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "جاري الدخول..." : "دخول"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="page-shell">تحميل...</div>}>
      <LoginForm />
    </Suspense>
  );
}

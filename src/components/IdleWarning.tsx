"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";

const IDLE_MS = Number(process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MS ?? 3600000);

export function IdleWarning({ userName }: { userName: string }) {
  const [open, setOpen] = useState(false);
  const lastActive = useRef(Date.now());
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const bump = () => {
      lastActive.current = Date.now();
      if (open) setOpen(false);
    };

    const events: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
    ];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));

    timer.current = setInterval(() => {
      if (Date.now() - lastActive.current >= IDLE_MS) {
        setOpen(true);
      }
    }, 15000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      if (timer.current) clearInterval(timer.current);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "var(--tmkeen-overlay)" }}
      role="dialog"
      aria-modal="true"
    >
      <div className="panel w-full max-w-md shadow-lg">
        <h2 className="text-xl font-bold text-primary mb-2">تنبيه الجلسة</h2>
        <p className="mb-4 leading-7">
          مضت ساعة دون نشاط. المستخدم الحالي: <strong>{userName}</strong>
        </p>
        <div className="flex gap-3 flex-wrap">
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              lastActive.current = Date.now();
              setOpen(false);
            }}
          >
            البقاء
          </button>
          <button type="button" className="btn-secondary" onClick={() => signOut({ callbackUrl: "/login" })}>
            تسجيل الخروج
          </button>
        </div>
      </div>
    </div>
  );
}

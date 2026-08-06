"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ToastTone = "success" | "warning" | "danger" | "info";
type ToastItem = { id: number; title: string; body?: string; tone: ToastTone };

type ToastApi = {
  push: (input: { title: string; body?: string; tone?: ToastTone }) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((input: { title: string; body?: string; tone?: ToastTone }) => {
    const id = Date.now() + Math.random();
    const tone = input.tone ?? "info";
    setItems((prev) => [...prev, { id, title: input.title, body: input.body, tone }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const api = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="zad-toast-host" aria-live="polite" aria-relevant="additions">
        {items.map((t) => (
          <div key={t.id} className={`zad-toast zad-toast--${t.tone}`} role={t.tone === "danger" ? "alert" : "status"}>
            <div>
              <p className="zad-toast__title">{t.title}</p>
              {t.body ? <p className="zad-toast__body">{t.body}</p> : null}
            </div>
            <button
              type="button"
              className="zad-toast__close"
              aria-label="إغلاق الإشعار"
              onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      push: () => undefined,
    };
  }
  return ctx;
}

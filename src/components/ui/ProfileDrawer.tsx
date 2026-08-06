"use client";

import { useEffect, useId, useRef } from "react";

/** درج تفاصيل من inline-start — O(1) */
export function ProfileDrawer({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="zad-drawer-root" role="presentation">
      <button
        type="button"
        className="zad-drawer-backdrop"
        aria-label="إغلاق"
        onClick={() => onCloseRef.current()}
      />
      <div
        ref={panelRef}
        className="zad-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="zad-drawer-header">
          <h2 id={titleId} className="zad-drawer-title">
            {title}
          </h2>
          <button
            type="button"
            className="btn-secondary zad-drawer-close"
            onClick={() => onCloseRef.current()}
          >
            إغلاق
          </button>
        </div>
        <div className="zad-drawer-body">{children}</div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useId, useRef } from "react";

export function Modal({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // التركيز مرة واحدة عند الفتح فقط — لا تعتمد على هوية onClose حتى لا يُسرق التركيز مع كل حرف
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    const active = document.activeElement;
    const alreadyInside = !!panel && !!active && panel.contains(active);
    if (!alreadyInside) {
      panel?.focus();
    }

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-root" role="presentation">
      <button
        type="button"
        className="modal-backdrop"
        aria-label="إغلاق"
        onClick={() => onCloseRef.current()}
      />
      <div
        ref={panelRef}
        className={`modal-panel${wide ? " modal-panel--wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal-header">
          <h2 id={titleId} className="modal-title">
            {title}
          </h2>
          <button
            type="button"
            className="btn-secondary btn-sm modal-close"
            onClick={() => onCloseRef.current()}
          >
            إغلاق
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

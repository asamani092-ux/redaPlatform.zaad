"use client";

import type { ReactNode } from "react";
import { Modal } from "@/components/Modal";

/** حوار تأكيد/تدميري فوق Modal الحالي — ثبات واجهة Modal */
export function ConfirmDialog({
  open,
  title,
  body,
  children,
  confirmLabel = "تأكيد",
  cancelLabel = "إلغاء",
  destructive,
  busy,
  wide,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body?: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  wide?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} title={title} onClose={onClose} wide={wide}>
      {body ? <p className="page-header__desc">{body}</p> : null}
      {children}
      <div className="zad-confirm-actions">
        <button
          type="button"
          className={destructive ? "btn-danger" : "btn-primary"}
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? "جاري…" : confirmLabel}
        </button>
        <button type="button" className="btn-secondary" disabled={busy} onClick={onClose}>
          {cancelLabel}
        </button>
      </div>
    </Modal>
  );
}

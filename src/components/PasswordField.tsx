"use client";

import { useState, type InputHTMLAttributes } from "react";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3 3l18 18M10.6 10.7a2.5 2.5 0 003.5 3.5M9.9 5.2A10.4 10.4 0 0112 5c5.2 0 9.2 3.4 10.5 7-.4 1.1-1.1 2.2-2 3.1M6.1 6.2C4.4 7.4 3.2 9 2.5 12c1.3 3.6 5.3 7 10.5 7 1.2 0 2.3-.2 3.4-.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2.5 12C3.8 8.4 7.8 5 13 5s9.2 3.4 10.5 7c-1.3 3.6-5.3 7-10.5 7S3.8 15.6 2.5 12z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

/** حقل كلمة مرور مع أيقونة عين يمين الحقل — يحافظ على name/id. */
export function PasswordField({ className = "", disabled, ...rest }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-field">
      <input
        {...rest}
        type={visible ? "text" : "password"}
        className={`input-field password-field__input${className ? ` ${className}` : ""}`}
        dir={rest.dir ?? "ltr"}
        disabled={disabled}
      />
      <button
        type="button"
        className="password-field__toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
        aria-pressed={visible}
        disabled={disabled}
      >
        <EyeIcon open={visible} />
      </button>
    </div>
  );
}

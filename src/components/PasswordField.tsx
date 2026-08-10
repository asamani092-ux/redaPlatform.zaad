"use client";

import { useState, type InputHTMLAttributes } from "react";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

/** حقل كلمة مرور مع إظهار/إخفاء — يحافظ على name/id للواجهات. */
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
        {visible ? "إخفاء" : "إظهار"}
      </button>
    </div>
  );
}

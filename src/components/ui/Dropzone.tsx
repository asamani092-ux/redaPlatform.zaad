"use client";

import { useRef, useState } from "react";

/** منطقة رفع ملفات — لا تغيّر اسم onFiles */
export function Dropzone({
  accept,
  multiple,
  onFiles,
  title = "اسحب الملف هنا أو اختر للتصفح",
  body,
}: {
  accept?: string;
  multiple?: boolean;
  onFiles: (files: FileList) => void;
  title?: string;
  body?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  return (
    <div
      className={`zad-dropzone ${drag ? "is-dragover" : ""}`}
      role="button"
      tabIndex={0}
      aria-label={title}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
      }}
    >
      <p className="zad-dropzone__title">{title}</p>
      {body ? <p className="page-header__desc">{body}</p> : null}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
        }}
      />
    </div>
  );
}

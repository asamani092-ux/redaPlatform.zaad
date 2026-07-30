"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  onScan: (value: string) => void;
  active: boolean;
};

export function BarcodeScanner({ onScan, active }: Props) {
  const regionId = useRef(`qr-reader-${Math.random().toString(36).slice(2)}`).current;
  const [error, setError] = useState("");
  const lastValue = useRef("");
  const lastAt = useRef(0);

  useEffect(() => {
    if (!active) return;
    let scanner: {
      stop: () => Promise<void>;
      clear: () => void;
    } | null = null;
    let cancelled = false;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const instance = new Html5Qrcode(regionId);
        scanner = instance;
        await instance.start(
          { facingMode: "environment" },
          { fps: 8, qrbox: { width: 240, height: 240 } },
          (decoded: string) => {
            const now = Date.now();
            if (decoded === lastValue.current && now - lastAt.current < 2500) return;
            lastValue.current = decoded;
            lastAt.current = now;
            onScan(decoded.trim());
          },
          () => undefined,
        );
        setError("");
      } catch (e) {
        setError(
          e instanceof Error
            ? `تعذر تشغيل الكاميرا: ${e.message}`
            : "تعذر تشغيل الكاميرا",
        );
      }
    })();

    return () => {
      cancelled = true;
      if (scanner) {
        void scanner
          .stop()
          .then(() => scanner?.clear())
          .catch(() => undefined);
      }
    };
  }, [active, onScan, regionId]);

  if (!active) return null;

  return (
    <div>
      <div id={regionId} className="scan-box" />
      {error ? <p className="msg msg-error" style={{ marginTop: "0.75rem" }}>{error}</p> : null}
    </div>
  );
}

export function Skeleton({
  lines = 3,
  height = "1rem",
}: {
  lines?: number;
  height?: string;
}) {
  return (
    <div role="status" aria-live="polite" aria-label="جارٍ التحميل" style={{ display: "grid", gap: "var(--space-2)" }}>
      {Array.from({ length: lines }, (_, i) => (
        <span
          key={i}
          className="zad-skeleton"
          style={{ height, width: i === lines - 1 ? "70%" : "100%" }}
        />
      ))}
    </div>
  );
}

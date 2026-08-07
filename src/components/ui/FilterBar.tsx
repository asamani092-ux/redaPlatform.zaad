"use client";

export function FilterBar({
  children,
  chips,
  onClear,
}: {
  children?: React.ReactNode;
  chips?: Array<{ key: string; label: string }>;
  onClear?: () => void;
}) {
  return (
    <div className="zad-filter-bar" role="search">
      {children}
      {chips?.length ? (
        <div className="zad-filter-bar__chips">
          {chips.map((c) => (
            <span key={c.key} className="zad-chip zad-chip--neutral">
              {c.label}
            </span>
          ))}
        </div>
      ) : null}
      {onClear ? (
        <button type="button" className="btn-secondary btn-sm" onClick={onClear}>
          مسح
        </button>
      ) : null}
    </div>
  );
}

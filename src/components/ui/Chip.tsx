export function Chip({
  label,
  tone = "brand",
  onRemove,
}: {
  label: string;
  tone?: "brand" | "success" | "warning" | "danger" | "neutral";
  onRemove?: () => void;
}) {
  return (
    <span className={`zad-chip zad-chip--${tone}`}>
      {label}
      {onRemove ? (
        <button type="button" className="zad-chip__remove" aria-label={`حذف ${label}`} onClick={onRemove}>
          ×
        </button>
      ) : null}
    </span>
  );
}

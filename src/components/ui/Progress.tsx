export function Progress({
  value,
  label,
}: {
  value: number;
  label?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="zad-progress">
      {label ? <div className="zad-progress__label">{label}</div> : null}
      <div
        className="zad-progress__track"
        role="progressbar"
        aria-valuenow={v}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "التقدّم"}
      >
        <span className="zad-progress__bar" style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

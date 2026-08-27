export function KpiCard({
  label,
  value,
  delta,
  className,
}: {
  label: string;
  value: string | number;
  delta?: { value: string; direction: "up" | "down" | "flat" };
  className?: string;
}) {
  return (
    <div className={["zad-kpi", className].filter(Boolean).join(" ")}>
      <div className="zad-kpi__value">{value}</div>
      <div className="zad-kpi__label">{label}</div>
      {delta ? (
        <div className={`zad-kpi__delta zad-kpi__delta--${delta.direction}`}>{delta.value}</div>
      ) : null}
    </div>
  );
}

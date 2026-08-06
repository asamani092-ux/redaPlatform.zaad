export function KpiCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string | number;
  delta?: { value: string; direction: "up" | "down" | "flat" };
}) {
  return (
    <div className="zad-kpi">
      <div className="zad-kpi__value">{value}</div>
      <div className="zad-kpi__label">{label}</div>
      {delta ? (
        <div className={`zad-kpi__delta zad-kpi__delta--${delta.direction}`}>{delta.value}</div>
      ) : null}
    </div>
  );
}

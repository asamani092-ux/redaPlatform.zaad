export function AttrChips({ attributes }: { attributes: Record<string, unknown> | null | undefined }) {
  if (!attributes || typeof attributes !== "object") return <span>—</span>;
  const entries = Object.entries(attributes);
  if (!entries.length) return <span>—</span>;
  return (
    <div className="attr-chips">
      {entries.map(([key, value]) => (
        <span key={key} className="attr-chip">
          <b>{key}</b>
          <span>{String(value ?? "")}</span>
        </span>
      ))}
    </div>
  );
}

export function AvatarGroup({
  names,
  max = 3,
}: {
  names: string[];
  max?: number;
}) {
  const shown = names.slice(0, max);
  const rest = Math.max(0, names.length - max);
  return (
    <div className="zad-avatar-group" aria-label={`مجموعة: ${names.length}`}>
      {rest > 0 ? <span className="zad-avatar zad-avatar--more">+{rest}</span> : null}
      {shown.map((n) => (
        <span key={n} className="zad-avatar" title={n} aria-label={n}>
          {n.trim().charAt(0) || "؟"}
        </span>
      ))}
    </div>
  );
}

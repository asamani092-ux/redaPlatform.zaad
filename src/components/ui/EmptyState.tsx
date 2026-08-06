export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="zad-empty" role="status">
      <h3 className="zad-empty__title">{title}</h3>
      {body ? <p className="zad-empty__body">{body}</p> : null}
      {action}
    </div>
  );
}

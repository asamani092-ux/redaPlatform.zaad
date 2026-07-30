export function BeneficiaryCard({
  name,
  nationalId,
  mobile,
  statusLabel,
  association,
  extra,
}: {
  name: string;
  nationalId: string;
  mobile?: string;
  statusLabel?: string;
  association?: string | null;
  extra?: React.ReactNode;
}) {
  return (
    <div className="beneficiary-card">
      <div className="beneficiary-card__name">{name}</div>
      <div dir="ltr">{nationalId}</div>
      {mobile ? <div dir="ltr">{mobile}</div> : null}
      {association ? <div>{association}</div> : null}
      <div className="beneficiary-card__meta">
        {statusLabel ? <span className="badge badge-muted">{statusLabel}</span> : null}
        {extra}
      </div>
    </div>
  );
}

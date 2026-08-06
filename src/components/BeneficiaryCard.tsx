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
    <div className="beneficiary-card zad-card card-section">
      <div className="beneficiary-card__name">{name}</div>

      <div className="beneficiary-card__row field-cell-row">
        <span className="beneficiary-card__label field-cell-label">رقم الهوية:</span>
        <span className="beneficiary-card__value field-cell-value" dir="ltr">
          {nationalId}
        </span>
      </div>

      {mobile ? (
        <div className="beneficiary-card__row field-cell-row">
          <span className="beneficiary-card__label field-cell-label">الجوال:</span>
          <span className="beneficiary-card__value field-cell-value" dir="ltr">
            {mobile}
          </span>
        </div>
      ) : null}

      {association ? (
        <div className="beneficiary-card__row field-cell-row">
          <span className="beneficiary-card__label field-cell-label">الجمعية:</span>
          <span className="beneficiary-card__text">{association}</span>
        </div>
      ) : null}

      <div className="beneficiary-card__meta">
        {statusLabel ? <span className="zad-badge zad-badge--brand">{statusLabel}</span> : null}
        {extra}
      </div>
    </div>
  );
}

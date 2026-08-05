"use client";

type Props = {
  page: number;
  totalPages: number;
  total: number;
  pageSize?: number;
  busy?: boolean;
  onPageChange: (page: number) => void;
};

/** شريط تصفح موحّد — O(1) */
export function PaginationBar({
  page,
  totalPages,
  total,
  pageSize = 50,
  busy,
  onPageChange,
}: Props) {
  if (total <= 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="pagination-bar" role="navigation" aria-label="تصفح الصفحات">
      <span className="pagination-bar__meta">
        {from}–{to} من {total}
      </span>
      <div className="pagination-bar__actions">
        <button
          type="button"
          className="btn-secondary"
          disabled={busy || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          السابق
        </button>
        <span className="pagination-bar__page">
          صفحة {page} / {totalPages}
        </span>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          التالي
        </button>
      </div>
    </div>
  );
}

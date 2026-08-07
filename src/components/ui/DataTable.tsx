import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";

/** غلاف جدول وفق عقد DataTable — يحافظ على table-wrap الحالي للتجاوب */
export function DataTable({
  children,
  loading,
  empty,
  emptyTitle = "لا بيانات",
  emptyBody,
  className = "",
}: {
  children: ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyTitle?: string;
  emptyBody?: string;
  className?: string;
}) {
  if (loading) {
    return (
      <div
        className={`table-wrap zad-table-wrap zad-data-table ${className}`.trim()}
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label="جارٍ التحميل"
      >
        <Skeleton lines={5} height="2.5rem" />
      </div>
    );
  }
  if (empty) {
    return (
      <div className={`table-wrap zad-table-wrap zad-data-table ${className}`.trim()}>
        <EmptyState title={emptyTitle} body={emptyBody} />
      </div>
    );
  }
  return (
    <div className={`table-wrap zad-table-wrap zad-data-table ${className}`.trim()}>
      {children}
    </div>
  );
}

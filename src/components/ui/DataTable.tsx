import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";

/** غلاف جدول وفق عقد DataTable — يكدّس الصفوف على الشاشات الضيقة ما لم يُعطَل */
export function DataTable({
  children,
  loading,
  empty,
  emptyTitle = "لا بيانات",
  emptyBody,
  className = "",
  stack = true,
}: {
  children: ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyTitle?: string;
  emptyBody?: string;
  className?: string;
  /** false = جدول أفقي حقيقي بدون تكديس بطاقات */
  stack?: boolean;
}) {
  const wrap =
    `table-wrap${stack ? " table-wrap--stack" : ""} zad-table-wrap zad-data-table ${className}`.trim();
  if (loading) {
    return (
      <div
        className={wrap}
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
      <div className={wrap}>
        <EmptyState title={emptyTitle} body={emptyBody} />
      </div>
    );
  }
  return <div className={wrap}>{children}</div>;
}

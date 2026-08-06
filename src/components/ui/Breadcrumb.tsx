import Link from "next/link";

export type BreadcrumbItem = { label: string; href?: string };

/** مسار تنقّل — O(n) عناصر */
export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  if (!items.length) return null;
  return (
    <nav className="zad-breadcrumb" aria-label="breadcrumb">
      <ol>
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
              {i > 0 ? <span className="zad-breadcrumb__sep" aria-hidden>‹</span> : null}
              {last || !item.href ? (
                <span aria-current={last ? "page" : undefined}>{item.label}</span>
              ) : (
                <Link href={item.href}>{item.label}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

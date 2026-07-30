"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { IdleWarning } from "@/components/IdleWarning";
import { ROLE_LABELS, navItemsForRole } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";

export function AppShell({
  children,
  user,
  showTrialEval = false,
}: {
  children: React.ReactNode;
  user: { name: string; role: Role; mobile: string };
  showTrialEval?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [activeExhibition, setActiveExhibition] = useState<{
    name: string;
    location?: string | null;
  } | null>(null);
  const items = navItemsForRole(user.role);

  useEffect(() => {
    let alive = true;
    fetch("/api/exhibitions/active")
      .then((r) => r.json())
      .then((j) => {
        if (alive) setActiveExhibition(j.active ?? null);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [pathname]);

  return (
    <div className="app-frame" data-tmkeen>
      <aside className={`app-sidebar ${open ? "is-open" : ""}`}>
        <div className="app-sidebar__brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.webp" alt="رداء" width={40} height={40} />
          <div>
            <div className="app-sidebar__title">منصة رداء</div>
            <div className="app-sidebar__meta">{ROLE_LABELS[user.role]}</div>
          </div>
        </div>

        <div className="app-exhibition-badge" title={activeExhibition?.name ?? "لا يوجد معرض نشط"}>
          {activeExhibition ? (
            <>
              <span className="app-exhibition-badge__label">المعرض النشط</span>
              <strong>{activeExhibition.name}</strong>
              {activeExhibition.location ? (
                <span className="app-exhibition-badge__loc">{activeExhibition.location}</span>
              ) : null}
            </>
          ) : (
            <span className="app-exhibition-badge__empty">لا يوجد معرض نشط</span>
          )}
        </div>

        <nav className="app-sidebar__nav" aria-label="القائمة الرئيسية">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`app-nav-link ${active ? "is-active" : ""}`}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            );
          })}
          {showTrialEval ? (
            <Link
              href="/تقييم-التجربة"
              className={`app-nav-link ${pathname.startsWith("/تقييم-التجربة") ? "is-active" : ""}`}
              onClick={() => setOpen(false)}
            >
              تقييم التجربة
            </Link>
          ) : null}
        </nav>

        <div className="app-sidebar__footer">
          <div className="app-sidebar__user">
            <strong>{user.name}</strong>
            <span dir="ltr">{user.mobile}</span>
          </div>
          <button
            type="button"
            className="btn-secondary app-sidebar__logout"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {open ? (
        <button type="button" className="app-backdrop" aria-label="إغلاق القائمة" onClick={() => setOpen(false)} />
      ) : null}

      <div className="app-main">
        <header className="app-topbar">
          <button type="button" className="app-menu-btn btn-secondary" onClick={() => setOpen((v) => !v)}>
            القائمة
          </button>
          <div className="app-topbar__brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.webp" alt="" width={28} height={28} />
            <span>{activeExhibition ? activeExhibition.name : "منصة رداء"}</span>
          </div>
          <div className="app-topbar__user">{user.name}</div>
        </header>
        <main className="app-content">{children}</main>
      </div>

      <IdleWarning userName={user.name} />
    </div>
  );
}

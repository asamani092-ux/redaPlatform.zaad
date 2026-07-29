"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { IdleWarning } from "@/components/IdleWarning";
import { ROLE_LABELS } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/enums";

type NavItem = { href: string; label: string; roles?: Role[] };

const NAV: NavItem[] = [
  { href: "/dashboard", label: "لوحة التحكم" },
  { href: "/beneficiaries", label: "المستفيدون" },
  { href: "/invites", label: "الدعوات" },
  { href: "/attendance", label: "الحضور" },
  { href: "/dispense", label: "صرف القطع" },
  { href: "/inventory", label: "المخزون" },
  { href: "/reports", label: "التقارير" },
  { href: "/survey", label: "الاستبيان" },
  { href: "/settings", label: "الإعدادات", roles: ["ADMIN"] },
  { href: "/users", label: "المستخدمون", roles: ["ADMIN"] },
  { href: "/audit", label: "سجل العمليات", roles: ["ADMIN"] },
];

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: { name: string; role: Role; mobile: string };
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((item) => !item.roles || item.roles.includes(user.role));

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

      {open ? <button type="button" className="app-backdrop" aria-label="إغلاق القائمة" onClick={() => setOpen(false)} /> : null}

      <div className="app-main">
        <header className="app-topbar">
          <button type="button" className="app-menu-btn btn-secondary" onClick={() => setOpen((v) => !v)}>
            القائمة
          </button>
          <div className="app-topbar__brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.webp" alt="" width={28} height={28} />
            <span>منصة رداء</span>
          </div>
          <div className="app-topbar__user">{user.name}</div>
        </header>
        <main className="app-content">{children}</main>
      </div>

      <IdleWarning userName={user.name} />
    </div>
  );
}

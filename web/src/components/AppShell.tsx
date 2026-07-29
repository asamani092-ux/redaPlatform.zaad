"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
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
  const items = NAV.filter((item) => !item.roles || item.roles.includes(user.role));

  return (
    <div className="min-h-screen">
      <header className="border-b border-surface-border bg-white/90 backdrop-blur sticky top-0 z-40">
        <div className="page-shell flex items-center justify-between gap-4 py-3">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.webp" alt="رداء" width={44} height={44} className="rounded-lg" />
            <div>
              <div className="text-xl font-extrabold text-primary leading-none">منصة رداء</div>
              <div className="text-xs mt-1">{ROLE_LABELS[user.role]} — {user.name}</div>
            </div>
          </div>
          <button type="button" className="btn-secondary !py-2 !px-3 text-sm" onClick={() => signOut({ callbackUrl: "/login" })}>
            خروج
          </button>
        </div>
        <nav className="page-shell !pt-0 !pb-3 overflow-x-auto">
          <ul className="flex gap-2 min-w-max">
            {items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`inline-flex px-3 py-2 rounded-lg text-sm font-semibold transition ${
                      active
                        ? "bg-primary text-white"
                        : "bg-surface-muted text-brand-gray hover:bg-primary/10"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>
      <main className="page-shell">{children}</main>
      <IdleWarning userName={user.name} />
    </div>
  );
}

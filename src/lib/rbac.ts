import { Role } from "@/generated/prisma/enums";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "مدير النظام",
  REGISTRATION: "موظف التسجيل",
  RECEPTION: "موظف استقبال المستفيدين",
  DISTRIBUTION: "موظف توزيع القطع",
  INVENTORY: "مسؤول المخزون",
  REPORTS: "مسؤول التقارير",
};

export type AppPermission =
  | "dashboard:view"
  | "beneficiaries:manage"
  | "beneficiaries:view"
  | "invites:manage"
  | "attendance:manage"
  | "attendance:exception"
  | "dispense:manage"
  | "dispense:override"
  | "inventory:manage"
  | "stores:view"
  | "stores:manage"
  | "settings:manage"
  | "exhibitions:manage"
  | "reports:view"
  | "reports:export"
  | "users:manage"
  | "survey:manage"
  | "audit:view"
  | "messages:view";

const ROLE_PERMISSIONS: Record<Role, AppPermission[]> = {
  ADMIN: [
    "dashboard:view",
    "beneficiaries:manage",
    "beneficiaries:view",
    "invites:manage",
    "attendance:manage",
    "attendance:exception",
    "dispense:manage",
    "dispense:override",
    "inventory:manage",
    "stores:view",
    "stores:manage",
    "settings:manage",
    "exhibitions:manage",
    "reports:view",
    "reports:export",
    "users:manage",
    "survey:manage",
    "audit:view",
    "messages:view",
  ],
  REGISTRATION: [
    "beneficiaries:manage",
    "beneficiaries:view",
    "invites:manage",
    "messages:view",
  ],
  RECEPTION: ["beneficiaries:view", "attendance:manage", "attendance:exception"],
  DISTRIBUTION: ["dispense:manage", "dispense:override", "messages:view", "stores:view"],
  INVENTORY: ["inventory:manage", "stores:view", "stores:manage"],
  REPORTS: [
    "dashboard:view",
    "reports:view",
    "reports:export",
    "survey:manage",
    "messages:view",
    "stores:view",
  ],
};

export type NavItem = {
  href: string;
  label: string;
  permission: AppPermission;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "لوحة التحكم", permission: "dashboard:view" },
  { href: "/beneficiaries", label: "المستفيدون", permission: "beneficiaries:view" },
  { href: "/invites", label: "الدعوات", permission: "invites:manage" },
  { href: "/attendance", label: "الحضور", permission: "attendance:manage" },
  { href: "/dispense", label: "صرف القطع", permission: "dispense:manage" },
  { href: "/inventory", label: "المخزون", permission: "inventory:manage" },
  { href: "/stores", label: "المتاجر", permission: "stores:view" },
  { href: "/reports", label: "التقارير", permission: "reports:view" },
  { href: "/survey", label: "الاستبيان", permission: "survey:manage" },
  { href: "/exhibitions", label: "المعارض", permission: "exhibitions:manage" },
  { href: "/settings", label: "الإعدادات", permission: "settings:manage" },
  { href: "/users", label: "المستخدمون", permission: "users:manage" },
  { href: "/audit", label: "سجل العمليات", permission: "audit:view" },
];

export function hasPermission(role: Role, permission: AppPermission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function navItemsForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => hasPermission(role, item.permission));
}

const ROLE_HOME: Partial<Record<Role, string>> = {
  ADMIN: "/dashboard",
  RECEPTION: "/attendance",
  REGISTRATION: "/beneficiaries",
  DISTRIBUTION: "/dispense",
  INVENTORY: "/inventory",
  REPORTS: "/reports",
};

/** الصفحة الرئيسية حسب الدور — O(1) */
export function homePathForRole(role: Role): string {
  const preferred = ROLE_HOME[role];
  if (preferred && canAccessPath(role, preferred)) return preferred;
  const first = navItemsForRole(role)[0];
  return first?.href ?? "/login";
}

export function canAccessPath(role: Role, pathname: string): boolean {
  if (pathname.startsWith("/login")) return true;
  if (pathname.startsWith("/trial-eval")) return role === Role.ADMIN;
  if (role === Role.ADMIN) return true;

  const rules: Array<{ prefix: string; permission: AppPermission }> = [
    { prefix: "/dashboard", permission: "dashboard:view" },
    { prefix: "/beneficiaries", permission: "beneficiaries:view" },
    { prefix: "/invites", permission: "invites:manage" },
    { prefix: "/attendance", permission: "attendance:manage" },
    { prefix: "/dispense", permission: "dispense:manage" },
    { prefix: "/inventory", permission: "inventory:manage" },
    { prefix: "/stores", permission: "stores:view" },
    { prefix: "/exhibitions", permission: "exhibitions:manage" },
    { prefix: "/settings", permission: "settings:manage" },
    { prefix: "/reports", permission: "reports:view" },
    { prefix: "/users", permission: "users:manage" },
    { prefix: "/survey", permission: "survey:manage" },
    { prefix: "/messages", permission: "messages:view" },
    { prefix: "/audit", permission: "audit:view" },
  ];

  const match = rules.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
  if (!match) return pathname === "/" || pathname.startsWith("/api/auth");
  return hasPermission(role, match.permission);
}

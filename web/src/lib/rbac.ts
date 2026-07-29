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
  | "settings:manage"
  | "reports:view"
  | "reports:export"
  | "users:manage"
  | "survey:manage"
  | "audit:view";

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
    "settings:manage",
    "reports:view",
    "reports:export",
    "users:manage",
    "survey:manage",
    "audit:view",
  ],
  REGISTRATION: [
    "dashboard:view",
    "beneficiaries:manage",
    "beneficiaries:view",
    "invites:manage",
  ],
  RECEPTION: [
    "dashboard:view",
    "beneficiaries:view",
    "attendance:manage",
  ],
  DISTRIBUTION: [
    "dashboard:view",
    "beneficiaries:view",
    "dispense:manage",
  ],
  INVENTORY: [
    "dashboard:view",
    "inventory:manage",
  ],
  REPORTS: [
    "dashboard:view",
    "reports:view",
    "reports:export",
    "survey:manage",
  ],
};

export function hasPermission(role: Role, permission: AppPermission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function canAccessPath(role: Role, pathname: string): boolean {
  if (pathname.startsWith("/login")) return true;
  if (role === Role.ADMIN) return true;

  const rules: Array<{ prefix: string; permission: AppPermission }> = [
    { prefix: "/dashboard", permission: "dashboard:view" },
    { prefix: "/beneficiaries", permission: "beneficiaries:view" },
    { prefix: "/invites", permission: "invites:manage" },
    { prefix: "/attendance", permission: "attendance:manage" },
    { prefix: "/dispense", permission: "dispense:manage" },
    { prefix: "/inventory", permission: "inventory:manage" },
    { prefix: "/settings", permission: "settings:manage" },
    { prefix: "/reports", permission: "reports:view" },
    { prefix: "/users", permission: "users:manage" },
    { prefix: "/survey", permission: "survey:manage" },
    { prefix: "/audit", permission: "audit:view" },
  ];

  const match = rules.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
  if (!match) return pathname === "/" || pathname.startsWith("/api/auth");
  return hasPermission(role, match.permission);
}

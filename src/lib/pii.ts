import { Role } from "@/generated/prisma/enums";

/** تصدير الهوية/الجوال الكامل مقصور على المدير — فرض من الخادم */
export function canExportFullIdentity(role: Role): boolean {
  return role === Role.ADMIN;
}

export type IdentityRow = {
  nationalId?: string;
  mobile?: string;
  [key: string]: unknown;
};

/** إخفاء حقول الهوية لغير المدير — O(n) */
export function redactIdentityFields<T extends IdentityRow>(
  rows: T[],
  canSeePii: boolean,
): T[] {
  if (canSeePii) return rows;
  return rows.map((r) => ({
    ...r,
    nationalId: r.nationalId ? "••••••••••" : r.nationalId,
    mobile: r.mobile ? "••••••••••" : r.mobile,
  }));
}

import { auth } from "@/auth";
import { hasPermission, type AppPermission } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";
import { NextResponse } from "next/server";

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return { error: NextResponse.json({ error: "غير مصرح" }, { status: 401 }) };
  }
  return {
    session,
    userId: session.user.id as string,
    role: session.user.role as Role,
    name: session.user.name ?? "",
  };
}

export async function requirePermission(permission: AppPermission) {
  const result = await requireSession();
  if ("error" in result) return result;
  if (!hasPermission(result.role, permission)) {
    return { error: NextResponse.json({ error: "لا تملك صلاحية" }, { status: 403 }) };
  }
  return result;
}

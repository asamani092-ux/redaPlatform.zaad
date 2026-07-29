import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import type { Role } from "@/generated/prisma/enums";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <AppShell
      user={{
        name: session.user.name ?? "مستخدم",
        role: session.user.role as Role,
        mobile: session.user.mobile,
      }}
    >
      {children}
    </AppShell>
  );
}

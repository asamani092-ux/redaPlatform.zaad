import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { isTrialEvalEnabled } from "@/lib/trial-eval-enabled";
import { Role } from "@/generated/prisma/enums";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role as Role;
  const showTrialEval = isTrialEvalEnabled() && role === Role.ADMIN;

  return (
    <AppShell
      user={{
        name: session.user.name ?? "مستخدم",
        role,
        mobile: session.user.mobile,
      }}
      showTrialEval={showTrialEval}
    >
      {children}
    </AppShell>
  );
}

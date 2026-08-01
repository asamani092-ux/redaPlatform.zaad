import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { TrialEvalClient } from "@/components/TrialEvalClient";
import { isTrialEvalEnabled } from "@/lib/trial-eval-enabled";
import { Role } from "@/generated/prisma/enums";

/** صفحة قبول التجربة — تُعطَّل أو تُحذف قبل الإطلاق النهائي */
export default async function TrialEvalPage() {
  if (!isTrialEvalEnabled()) notFound();

  const session = await auth();
  if (!session?.user || session.user.role !== Role.ADMIN) {
    notFound();
  }

  return <TrialEvalClient />;
}

import { prisma } from "@/lib/prisma";
import type { SurveyAudience } from "@/lib/survey-questions";

export type AudienceBeneficiary = {
  id: string;
  name: string;
  mobile: string;
};

/**
 * حلّ جمهور الاستبيان إلى مستفيدين مميّزين — Time: O(n)، Space: O(n).
 */
export async function resolveSurveyAudience(
  exhibitionId: string,
  audience: SurveyAudience,
): Promise<AudienceBeneficiary[]> {
  const select = { id: true, name: true, mobile: true } as const;

  if (audience === "received") {
    const rows = await prisma.dispenseOrder.findMany({
      where: { exhibitionId },
      distinct: ["beneficiaryId"],
      select: { beneficiary: { select } },
    });
    return dedupe(rows.map((r) => r.beneficiary));
  }

  if (audience === "attended_only") {
    const [attended, received] = await Promise.all([
      prisma.attendance.findMany({
        where: { exhibitionId },
        select: { beneficiaryId: true, beneficiary: { select } },
      }),
      prisma.dispenseOrder.findMany({
        where: { exhibitionId },
        distinct: ["beneficiaryId"],
        select: { beneficiaryId: true },
      }),
    ]);
    const receivedSet = new Set(received.map((r) => r.beneficiaryId));
    return dedupe(
      attended
        .filter((a) => !receivedSet.has(a.beneficiaryId))
        .map((a) => a.beneficiary),
    );
  }

  // invited_absent: مدعو ولم يحضر
  const [invites, attended] = await Promise.all([
    prisma.exhibitionInvite.findMany({
      where: { exhibitionId, invited: true },
      select: { beneficiaryId: true, beneficiary: { select } },
    }),
    prisma.attendance.findMany({
      where: { exhibitionId },
      select: { beneficiaryId: true },
    }),
  ]);
  const attendedSet = new Set(attended.map((a) => a.beneficiaryId));
  return dedupe(
    invites
      .filter((i) => !attendedSet.has(i.beneficiaryId))
      .map((i) => i.beneficiary),
  );
}

function dedupe(
  list: Array<AudienceBeneficiary | null | undefined>,
): AudienceBeneficiary[] {
  const seen = new Set<string>();
  const out: AudienceBeneficiary[] = [];
  for (const b of list) {
    if (!b || seen.has(b.id)) continue;
    seen.add(b.id);
    out.push(b);
  }
  return out;
}

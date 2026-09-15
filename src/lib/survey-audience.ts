import { prisma } from "@/lib/prisma";
import {
  OutboundMessageStatus,
  OutboundMessageType,
} from "@/generated/prisma/enums";
import {
  ASSOCIATION_ZAD_NAME,
  isZadAssociationLabel,
  type SurveyAudience,
} from "@/lib/survey-questions";
export {
  SURVEY_BROADCAST_BATCH_SIZE,
  buildSurveyBroadcastBatches,
  sliceSurveyBroadcastBatch,
  type SurveyBroadcastBatch,
} from "@/lib/survey-broadcast-batches";

/** اسم خيار الجمعية لمستفيدي الزاد — ثابت للمطابقة مع البذرة */

export type AudienceBeneficiary = {
  id: string;
  name: string;
  mobile: string;
};

/**
 * حلّ فئة مستفيدي الاستبيان إلى قائمة مميّزة — Time: O(n)، Space: O(n).
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

  if (audience === "association_zad") {
    void exhibitionId; // جمهور عام لكل مستفيدي الجمعية — غير مقيّد بالمعرض
    // يطابق associationId (خيار القائمة) وassociationOther (نص حر عند الاستيراد)
    const zadOptions = await prisma.associationOption.findMany({
      where: {
        OR: [
          { name: ASSOCIATION_ZAD_NAME },
          { name: { contains: "الزاد" } },
        ],
      },
      select: { id: true, name: true },
    });
    const zadIds = zadOptions
      .filter((o) => isZadAssociationLabel(o.name))
      .map((o) => o.id);
    const rows = await prisma.beneficiary.findMany({
      where: {
        OR: [
          ...(zadIds.length ? [{ associationId: { in: zadIds } }] : []),
          { associationOther: ASSOCIATION_ZAD_NAME },
          { associationOther: { contains: "الزاد" } },
        ],
      },
      select,
    });
    return dedupe(rows);
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

/**
 * عدد مستهدفي الإرسال لفئة الاستبيان — مع/بدون جوال.
 * Time: O(n) — Space: O(n).
 */
export async function countSurveyAudience(
  exhibitionId: string,
  audience: SurveyAudience,
): Promise<{ total: number; withMobile: number; withoutMobile: number }> {
  const list = await resolveSurveyAudience(exhibitionId, audience);
  let withMobile = 0;
  for (const b of list) {
    if (b.mobile?.trim()) withMobile++;
  }
  return {
    total: list.length,
    withMobile,
    withoutMobile: list.length - withMobile,
  };
}

/**
 * مستهدفو البث بجوال — مع استبعاد من أُرسل لهم SURVEY بنجاح (SENT/STUBBED).
 * Time: O(n) — Space: O(n).
 */
export async function listSurveyBroadcastTargets(
  exhibitionId: string,
  audience: SurveyAudience,
  opts?: { includePreviouslySent?: boolean },
): Promise<AudienceBeneficiary[]> {
  const list = await resolveSurveyAudience(exhibitionId, audience);
  const withMobile = list.filter((b) => !!b.mobile?.trim());
  if (opts?.includePreviouslySent || withMobile.length === 0) {
    return withMobile;
  }

  const sentRows = await prisma.outboundMessage.findMany({
    where: {
      exhibitionId,
      type: OutboundMessageType.SURVEY,
      status: {
        in: [OutboundMessageStatus.SENT, OutboundMessageStatus.STUBBED],
      },
      beneficiaryId: { in: withMobile.map((b) => b.id) },
    },
    select: { beneficiaryId: true },
    distinct: ["beneficiaryId"],
  });
  const sentSet = new Set(
    sentRows
      .map((r) => r.beneficiaryId)
      .filter((id): id is string => typeof id === "string" && !!id),
  );
  return withMobile.filter((b) => !sentSet.has(b.id));
}

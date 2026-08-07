import { prisma } from "@/lib/prisma";
import { OutboundMessageType } from "@/generated/prisma/enums";
import { inviteWhatsappLabel } from "@/lib/invite-whatsapp";
import { isValidSaudiMobile } from "@/lib/mobile";

export type OutboundLatest = {
  status: string;
  errorMessage: string | null;
  createdAt: Date;
};

/**
 * أحدث رسالة صادرة لكل مستفيد حسب النوع — O(n) على الرسائل.
 */
export async function latestOutboundByType(
  exhibitionId: string,
  beneficiaryIds: string[],
  type: OutboundMessageType,
): Promise<Map<string, OutboundLatest>> {
  const map = new Map<string, OutboundLatest>();
  if (!beneficiaryIds.length) return map;

  const messages = await prisma.outboundMessage.findMany({
    where: {
      exhibitionId,
      beneficiaryId: { in: beneficiaryIds },
      type,
    },
    orderBy: { createdAt: "desc" },
    select: {
      beneficiaryId: true,
      status: true,
      errorMessage: true,
      createdAt: true,
    },
  });

  for (const m of messages) {
    if (!m.beneficiaryId || map.has(m.beneficiaryId)) continue;
    map.set(m.beneficiaryId, {
      status: m.status,
      errorMessage: m.errorMessage,
      createdAt: m.createdAt,
    });
  }
  return map;
}

export type WhatsAppLogRow = {
  beneficiaryId: string;
  name: string;
  mobile: string;
  nationalId: string;
  mobileValid: boolean;
  hasInvite: boolean;
  hasDispense: boolean;
  inviteStatus: string | null;
  inviteStatusLabel: string;
  inviteError: string | null;
  inviteAt: string | null;
  surveyStatus: string | null;
  surveyStatusLabel: string;
  surveyError: string | null;
  surveyAt: string | null;
};

/**
 * بناء صفوف سجل واتساب للمعرض النشط — أسر مدعوّة ∪ من استلم.
 * Time: O(n)؛ Space: O(n).
 */
export async function buildWhatsAppLogRows(
  exhibitionId: string,
): Promise<WhatsAppLogRow[]> {
  const [invites, received] = await Promise.all([
    prisma.exhibitionInvite.findMany({
      where: { exhibitionId, invited: true },
      select: {
        beneficiaryId: true,
        beneficiary: {
          select: {
            id: true,
            name: true,
            mobile: true,
            nationalId: true,
          },
        },
      },
    }),
    prisma.dispenseOrder.findMany({
      where: { exhibitionId },
      distinct: ["beneficiaryId"],
      select: {
        beneficiaryId: true,
        beneficiary: {
          select: {
            id: true,
            name: true,
            mobile: true,
            nationalId: true,
          },
        },
      },
    }),
  ]);

  const byId = new Map<
    string,
    {
      id: string;
      name: string;
      mobile: string;
      nationalId: string;
      hasInvite: boolean;
      hasDispense: boolean;
    }
  >();

  for (const inv of invites) {
    const b = inv.beneficiary;
    byId.set(b.id, {
      id: b.id,
      name: b.name,
      mobile: b.mobile,
      nationalId: b.nationalId,
      hasInvite: true,
      hasDispense: false,
    });
  }
  for (const d of received) {
    const b = d.beneficiary;
    const prev = byId.get(b.id);
    if (prev) {
      prev.hasDispense = true;
    } else {
      byId.set(b.id, {
        id: b.id,
        name: b.name,
        mobile: b.mobile,
        nationalId: b.nationalId,
        hasInvite: false,
        hasDispense: true,
      });
    }
  }

  const ids = [...byId.keys()];
  const [inviteMap, surveyMap] = await Promise.all([
    latestOutboundByType(exhibitionId, ids, OutboundMessageType.INVITATION),
    latestOutboundByType(exhibitionId, ids, OutboundMessageType.SURVEY),
  ]);

  const rows: WhatsAppLogRow[] = ids.map((id) => {
    const b = byId.get(id)!;
    const inv = inviteMap.get(id);
    const sur = surveyMap.get(id);
    return {
      beneficiaryId: b.id,
      name: b.name,
      mobile: b.mobile,
      nationalId: b.nationalId,
      mobileValid: isValidSaudiMobile(b.mobile),
      hasInvite: b.hasInvite,
      hasDispense: b.hasDispense,
      inviteStatus: inv?.status ?? null,
      inviteStatusLabel: inviteWhatsappLabel(inv?.status),
      inviteError: inv?.errorMessage ?? null,
      inviteAt: inv?.createdAt?.toISOString() ?? null,
      surveyStatus: sur?.status ?? null,
      surveyStatusLabel: inviteWhatsappLabel(sur?.status),
      surveyError: sur?.errorMessage ?? null,
      surveyAt: sur?.createdAt?.toISOString() ?? null,
    };
  });

  rows.sort((a, b) => a.name.localeCompare(b.name, "ar"));
  return rows;
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { requireActiveExhibition } from "@/lib/exhibition";
import { resolveStatus, STATUS_LABELS } from "@/lib/status";
import { hasPermission } from "@/lib/rbac";
import { effectiveEntitlement } from "@/lib/entitlement";

/** بحث مستفيد للمعاينة قبل الحضور/الصرف — O(1) بالفهارس */
export async function GET(req: NextRequest) {
  const authz = await requireSession();
  if ("error" in authz) return authz.error;

  const canOps =
    hasPermission(authz.role, "attendance:manage") ||
    hasPermission(authz.role, "dispense:manage") ||
    hasPermission(authz.role, "beneficiaries:view");
  if (!canOps) {
    return NextResponse.json({ error: "لا تملك صلاحية" }, { status: 403 });
  }

  let exhibition;
  try {
    exhibition = await requireActiveExhibition();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "لا يوجد معرض نشط" },
      { status: 400 },
    );
  }

  const qrToken = req.nextUrl.searchParams.get("qrToken")?.trim();
  const q = req.nextUrl.searchParams.get("q")?.trim();

  let beneficiary = null;
  let invite = null;

  if (qrToken) {
    invite = await prisma.exhibitionInvite.findUnique({
      where: { qrToken },
      include: { beneficiary: { include: { association: true } } },
    });
    if (!invite) {
      return NextResponse.json({ error: "رمز غير صالح" }, { status: 404 });
    }
    if (invite.exhibitionId !== exhibition.id) {
      return NextResponse.json(
        { error: "الرمز لا يتبع المعرض النشط" },
        { status: 409 },
      );
    }
    beneficiary = invite.beneficiary;
  } else if (q) {
    beneficiary = await prisma.beneficiary.findFirst({
      where: {
        OR: [
          { nationalId: q },
          { mobile: q },
          { name: { contains: q, mode: "insensitive" } },
        ],
      },
      include: { association: true },
    });
    if (!beneficiary) {
      return NextResponse.json({ error: "المستفيد غير موجود" }, { status: 404 });
    }
    invite = await prisma.exhibitionInvite.findUnique({
      where: {
        exhibitionId_beneficiaryId: {
          exhibitionId: exhibition.id,
          beneficiaryId: beneficiary.id,
        },
      },
    });
  } else {
    return NextResponse.json({ error: "حدد qrToken أو q" }, { status: 400 });
  }

  const attendance = await prisma.attendance.findUnique({
    where: {
      exhibitionId_beneficiaryId: {
        exhibitionId: exhibition.id,
        beneficiaryId: beneficiary.id,
      },
    },
  });
  const dispenseOrders = await prisma.dispenseOrder.findMany({
    where: { exhibitionId: exhibition.id, beneficiaryId: beneficiary.id },
    orderBy: { createdAt: "desc" },
  });
  const latestDispense = dispenseOrders[0] ?? null;
  const previousPiecesTotal = dispenseOrders.reduce((s, o) => s + o.piecesCount, 0);

  const status = resolveStatus({
    invited: invite?.invited,
    attendanceType: attendance?.type ?? null,
    received: dispenseOrders.length > 0,
  });

  const base = exhibition.settings?.baseEntitlement ?? 1;
  // وحدة لكل تابع من الإعدادات — الافتراضي 1
  const perDep = exhibition.settings?.dependentsEntitlement ?? 1;
  const deps = beneficiary.dependentsCount ?? 0;
  // الفعلي المحسوب = الأساسي + التابعون × وحدة التابع (لا يُستبدل باستثناء صرف سابق)
  const computed = effectiveEntitlement(base, deps, perDep);
  const latestOverride = latestDispense?.entitledOverride ?? null;

  return NextResponse.json({
    exhibition: { id: exhibition.id, name: exhibition.name },
    baseEntitlement: base,
    dependentsEntitlement: perDep,
    dependentsCount: deps,
    effectiveEntitlement: computed,
    entitledPieces: computed,
    entitledOverride: latestOverride,
    overrideReason: latestDispense?.overrideReason ?? null,
    beneficiary: {
      id: beneficiary.id,
      name: beneficiary.name,
      nationalId: beneficiary.nationalId,
      mobile: beneficiary.mobile,
      dependentsCount: deps,
      association: beneficiary.association?.name ?? beneficiary.associationOther ?? null,
    },
    invite: invite
      ? { invited: invite.invited, qrToken: invite.qrToken }
      : null,
    attendance: attendance
      ? { type: attendance.type, checkedInAt: attendance.checkedInAt, exceptionReason: attendance.exceptionReason }
      : null,
    dispensed: dispenseOrders.length > 0,
    dispenseCount: dispenseOrders.length,
    previousPiecesTotal,
    status,
    statusLabel: STATUS_LABELS[status],
    computedEntitlement: computed,
  });
}

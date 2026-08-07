import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";
import { requireActiveExhibition } from "@/lib/exhibition";
import { hasPermission } from "@/lib/rbac";
import { buildPageMeta, parsePageParams } from "@/lib/pagination";
import { isValidSaudiMobile, MOBILE_ERROR, normalizeMobile } from "@/lib/mobile";
import {
  buildWhatsAppLogRows,
  type WhatsAppLogRow,
} from "@/lib/outbound-latest";

function canViewMessages(role: Parameters<typeof hasPermission>[0]): boolean {
  return (
    hasPermission(role, "messages:view") ||
    hasPermission(role, "invites:manage") ||
    hasPermission(role, "survey:manage")
  );
}

type ProblemFilter =
  | "all"
  | "invalid_mobile"
  | "invite_failed"
  | "survey_failed"
  | "invite_none"
  | "survey_none"
  | "no_dispense";

function matchesProblem(row: WhatsAppLogRow, problem: ProblemFilter): boolean {
  switch (problem) {
    case "invalid_mobile":
      return !row.mobileValid;
    case "invite_failed":
      return row.inviteStatus === "FAILED";
    case "survey_failed":
      return row.surveyStatus === "FAILED";
    case "invite_none":
      return !row.inviteStatus;
    case "survey_none":
      return !row.surveyStatus;
    case "no_dispense":
      return !row.hasDispense;
    default:
      return true;
  }
}

function matchesStatus(status: string | null, filter: string): boolean {
  if (!filter || filter === "all") return true;
  if (filter === "none") return !status;
  return status === filter;
}

/**
 * سجل رسائل واتساب (دعوة + استبيان) — Time: O(n) ثم ترشيح/ترقيم O(n).
 */
export async function GET(req: NextRequest) {
  const authz = await requireSession();
  if ("error" in authz) return authz.error;
  if (!canViewMessages(authz.role)) {
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

  const tab = req.nextUrl.searchParams.get("tab") === "survey" ? "survey" : "invite";
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  const inviteStatus = req.nextUrl.searchParams.get("inviteStatus") ?? "all";
  const surveyStatus = req.nextUrl.searchParams.get("surveyStatus") ?? "all";
  const problem = (req.nextUrl.searchParams.get("problem") ?? "all") as ProblemFilter;

  const rows = await buildWhatsAppLogRows(exhibition.id);
  let filtered = rows.filter((r) => {
    if (tab === "invite" && !r.hasInvite) return false;
    if (tab === "survey" && !(r.hasDispense || r.surveyStatus || r.hasInvite)) {
      return false;
    }
    if (!matchesStatus(r.inviteStatus, inviteStatus)) return false;
    if (!matchesStatus(r.surveyStatus, surveyStatus)) return false;
    if (!matchesProblem(r, problem)) return false;
    if (q) {
      const hay = `${r.name} ${r.mobile} ${r.nationalId}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // تبويب الاستبيان: أولوية من استلم أو فشل الاستبيان
  if (tab === "survey") {
    filtered = filtered.sort((a, b) => {
      const score = (r: WhatsAppLogRow) =>
        (r.surveyStatus === "FAILED" ? 0 : 1) + (r.hasDispense ? 0 : 2);
      return score(a) - score(b) || a.name.localeCompare(b.name, "ar");
    });
  }

  const { page, pageSize, skip, take } = parsePageParams(req.nextUrl.searchParams);
  const total = filtered.length;
  const data = filtered.slice(skip, skip + take);

  return NextResponse.json({
    exhibition: { id: exhibition.id, name: exhibition.name },
    data,
    counts: {
      total: rows.length,
      inviteFailed: rows.filter((r) => r.inviteStatus === "FAILED").length,
      surveyFailed: rows.filter((r) => r.surveyStatus === "FAILED").length,
      invalidMobile: rows.filter((r) => !r.mobileValid).length,
    },
    ...buildPageMeta(page, pageSize, total),
  });
}

const patchSchema = z.object({
  beneficiaryId: z.string().min(1),
  mobile: z.string().min(1),
});

/**
 * تصحيح جوال المستفيد من سجل الرسائل — O(1).
 */
export async function PATCH(req: NextRequest) {
  const authz = await requireSession();
  if ("error" in authz) return authz.error;
  if (
    !hasPermission(authz.role, "beneficiaries:manage") &&
    !hasPermission(authz.role, "invites:manage")
  ) {
    return NextResponse.json({ error: "لا تملك صلاحية تعديل الجوال" }, { status: 403 });
  }

  const body = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const mobile = normalizeMobile(body.data.mobile);
  if (!isValidSaudiMobile(mobile)) {
    return NextResponse.json({ error: MOBILE_ERROR }, { status: 400 });
  }

  const before = await prisma.beneficiary.findUnique({
    where: { id: body.data.beneficiaryId },
    select: { id: true, name: true, mobile: true },
  });
  if (!before) {
    return NextResponse.json({ error: "المستفيد غير موجود" }, { status: 404 });
  }

  const updated = await prisma.beneficiary.update({
    where: { id: before.id },
    data: { mobile },
    select: { id: true, name: true, mobile: true },
  });

  await writeAuditLog({
    userId: authz.userId,
    action: "UPDATE_BENEFICIARY",
    entityType: "Beneficiary",
    entityId: updated.id,
    before: { mobile: before.mobile },
    after: { mobile: updated.mobile, source: "messages-log" },
  });

  return NextResponse.json({
    data: {
      beneficiaryId: updated.id,
      name: updated.name,
      mobile: updated.mobile,
      mobileValid: true,
    },
  });
}

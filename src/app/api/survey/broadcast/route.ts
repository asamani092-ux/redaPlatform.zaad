import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/session";
import { writeAuditLog } from "@/lib/audit";
import { statusFromSendCounts } from "@/lib/audit-status";
import { requireActiveExhibition } from "@/lib/exhibition";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { OutboundMessageType } from "@/generated/prisma/enums";
import {
  audienceLabel,
  findSurvey,
  parseSurveyCatalog,
} from "@/lib/survey-questions";
import {
  countSurveyAudience,
  resolveSurveyAudience,
} from "@/lib/survey-audience";
import { buildSurveyMessage, resolveSurveyHeaderImageUrl, surveyTemplateParams } from "@/lib/survey-message";
import { resolveSurveyDelivery } from "@/lib/survey-link";
import { appOrigin } from "@/lib/app-url";
import { getWhatsAppConfig } from "@/lib/whatsapp-config";

const schema = z.object({
  surveyId: z.string().min(1),
  /** توافق خلفي: إن وُجد يتجاهل فئة مستفيدي الاستبيان */
  audience: z
    .enum(["attended", "received", "attended_only", "invited_absent"])
    .optional(),
});

function resolveAudienceFromBody(
  surveyAudience: import("@/lib/survey-questions").SurveyAudience,
  override?: string,
) {
  let audience = surveyAudience;
  if (override === "received") audience = "received";
  if (override === "attended" || override === "attended_only") {
    audience = "attended_only";
  }
  if (override === "invited_absent") audience = "invited_absent";
  return audience;
}

/**
 * معاينة عدد المستهدفين قبل الإرسال الجماعي — O(n).
 */
export async function GET(req: NextRequest) {
  const authz = await requirePermission("survey:manage");
  if ("error" in authz) return authz.error;

  let exhibition;
  try {
    exhibition = await requireActiveExhibition();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "لا يوجد معرض نشط" },
      { status: 400 },
    );
  }

  const surveyId = req.nextUrl.searchParams.get("surveyId")?.trim();
  if (!surveyId) {
    return NextResponse.json({ error: "حدد الاستبيان" }, { status: 400 });
  }

  const catalog = parseSurveyCatalog(exhibition.settings?.surveyQuestionsJson);
  const survey = findSurvey(catalog, surveyId);
  if (!survey || !survey.active) {
    return NextResponse.json({ error: "الاستبيان غير موجود أو غير مفعّل" }, { status: 404 });
  }

  const audience = resolveAudienceFromBody(
    survey.audience,
    req.nextUrl.searchParams.get("audience") ?? undefined,
  );
  const counts = await countSurveyAudience(exhibition.id, audience);

  return NextResponse.json({
    surveyId: survey.id,
    surveyTitle: survey.title,
    audience,
    audienceLabel: audienceLabel(audience),
    ...counts,
  });
}

/**
 * إرسال جماعي لاستبيان محدد حسب مستفيديه — O(n) بعدد المستهدفين.
 */
export async function POST(req: NextRequest) {
  const authz = await requirePermission("survey:manage");
  if ("error" in authz) return authz.error;

  let exhibition;
  try {
    exhibition = await requireActiveExhibition();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "لا يوجد معرض نشط" },
      { status: 400 },
    );
  }

  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "حدد الاستبيان المراد إرساله" }, { status: 400 });
  }

  const catalog = parseSurveyCatalog(exhibition.settings?.surveyQuestionsJson);
  const survey = findSurvey(catalog, body.data.surveyId);
  if (!survey || !survey.active) {
    return NextResponse.json({ error: "الاستبيان غير موجود أو غير مفعّل" }, { status: 404 });
  }

  let audience = resolveAudienceFromBody(survey.audience, body.data.audience);

  const beneficiaries = await resolveSurveyAudience(exhibition.id, audience);

  let sent = 0;
  let failed = 0;
  let stubbed = 0;
  const errors: Array<{
    beneficiaryId: string;
    beneficiaryName: string;
    mobile: string;
    reason: string;
  }> = [];

  const wa = await getWhatsAppConfig();
  const surveyHeaderUrl =
    resolveSurveyHeaderImageUrl(wa.surveyHeaderImageUrl) || undefined;

  for (const b of beneficiaries) {
    if (!b.mobile) {
      failed++;
      errors.push({
        beneficiaryId: b.id,
        beneficiaryName: b.name,
        mobile: "",
        reason: "لا يوجد رقم جوال",
      });
      continue;
    }
    const delivery = resolveSurveyDelivery({
      survey,
      exhibitionId: exhibition.id,
      beneficiaryId: b.id,
      origin: appOrigin(req),
    });
    if (!delivery.ok) {
      failed++;
      errors.push({
        beneficiaryId: b.id,
        beneficiaryName: b.name,
        mobile: b.mobile,
        reason: delivery.error,
      });
      continue;
    }
    const msg = await sendWhatsAppMessage({
      exhibitionId: exhibition.id,
      beneficiaryId: b.id,
      mobile: b.mobile,
      body: buildSurveyMessage(
        b.name,
        exhibition.name,
        delivery.url,
        survey.title,
      ),
      type: OutboundMessageType.SURVEY,
      createdById: authz.userId,
      mediaUrl: surveyHeaderUrl,
      templateParams: surveyTemplateParams(
        b.name,
        exhibition.name,
        delivery.url,
      ),
    });
    if (msg.status === "FAILED") {
      failed++;
      errors.push({
        beneficiaryId: b.id,
        beneficiaryName: b.name,
        mobile: b.mobile,
        reason: msg.errorMessage || "فشل إرسال واتساب",
      });
    } else if (msg.status === "STUBBED") {
      stubbed++;
    } else {
      sent++;
    }
  }

  const status = statusFromSendCounts({ sent, failed, stubbed });
  const statusReason =
    errors.length > 0
      ? errors
          .slice(0, 5)
          .map((e) => `${e.beneficiaryName}: ${e.reason}`)
          .join(" | ")
      : sent + stubbed === 0
        ? "لا مستهدفين للإرسال"
        : null;

  await writeAuditLog({
    userId: authz.userId,
    action: "SURVEY_BROADCAST",
    entityType: "SurveyResponse",
    entityId: exhibition.id,
    meta: {
      surveyId: survey.id,
      surveyTitle: survey.title,
      audience,
      sent,
      failed,
      stubbed,
      errors: errors.slice(0, 20),
    },
    status,
    statusReason,
  });

  return NextResponse.json({
    sent,
    failed,
    stubbed,
    errors,
    surveyId: survey.id,
    audience,
    audienceLabel: audienceLabel(audience),
    status,
    statusReason,
  });
}

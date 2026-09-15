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
  SURVEY_BROADCAST_BATCH_SIZE,
  buildSurveyBroadcastBatches,
  listSurveyBroadcastTargets,
  sliceSurveyBroadcastBatch,
} from "@/lib/survey-audience";
import {
  buildSurveyMessage,
  resolveSurveyWhatsAppOptions,
} from "@/lib/survey-message";
import { resolveSurveyDelivery } from "@/lib/survey-link";
import { appOrigin } from "@/lib/app-url";
import { getWhatsAppConfig } from "@/lib/whatsapp-config";

const postSchema = z.object({
  surveyId: z.string().min(1),
  batchIndex: z.number().int().min(0).optional(),
  /** معرّفات صريحة للدفعة (أولوية على batchIndex) — حد أقصى 200 */
  beneficiaryIds: z.array(z.string().min(1)).max(SURVEY_BROADCAST_BATCH_SIZE).optional(),
  includePreviouslySent: z.boolean().optional(),
  /** توافق خلفي: إن وُجد يتجاهل فئة مستفيدي الاستبيان */
  audience: z
    .enum(["attended", "received", "attended_only", "invited_absent", "association_zad"])
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
  if (override === "association_zad") audience = "association_zad";
  return audience;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * معاينة دفعات المستهدفين قبل الإرسال الجماعي — O(n).
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

  const includePreviouslySent =
    req.nextUrl.searchParams.get("includePreviouslySent") === "1" ||
    req.nextUrl.searchParams.get("includePreviouslySent") === "true";

  const catalog = parseSurveyCatalog(exhibition.settings?.surveyQuestionsJson);
  const survey = findSurvey(catalog, surveyId);
  if (!survey || !survey.active) {
    return NextResponse.json(
      { error: "الاستبيان غير موجود أو غير مفعّل" },
      { status: 404 },
    );
  }

  const audience = resolveAudienceFromBody(
    survey.audience,
    req.nextUrl.searchParams.get("audience") ?? undefined,
  );

  const targets = await listSurveyBroadcastTargets(exhibition.id, audience, {
    includePreviouslySent,
  });
  const batches = buildSurveyBroadcastBatches(
    targets.length,
    SURVEY_BROADCAST_BATCH_SIZE,
  );

  return NextResponse.json({
    surveyId: survey.id,
    surveyTitle: survey.title,
    audience,
    audienceLabel: audienceLabel(audience),
    batchSize: SURVEY_BROADCAST_BATCH_SIZE,
    remaining: targets.length,
    batches,
    orderedIds: targets.map((t) => t.id),
    includePreviouslySent,
    total: targets.length,
    withMobile: targets.length,
    withoutMobile: 0,
  });
}

/**
 * إرسال دفعة واحدة (حتى 200) — O(k) مع تأخير ثانية بين الرسائل.
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

  const body = postSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json(
      { error: "حدد الاستبيان ومعرّفات الدفعة أو batchIndex" },
      { status: 400 },
    );
  }

  const catalog = parseSurveyCatalog(exhibition.settings?.surveyQuestionsJson);
  const survey = findSurvey(catalog, body.data.surveyId);
  if (!survey || !survey.active) {
    return NextResponse.json(
      { error: "الاستبيان غير موجود أو غير مفعّل" },
      { status: 404 },
    );
  }

  const audience = resolveAudienceFromBody(survey.audience, body.data.audience);
  const includePreviouslySent = body.data.includePreviouslySent === true;

  const targets = await listSurveyBroadcastTargets(exhibition.id, audience, {
    includePreviouslySent,
  });
  const byId = new Map(targets.map((t) => [t.id, t]));

  let batch = [] as typeof targets;
  let batchIndex = body.data.batchIndex ?? 0;
  if (body.data.beneficiaryIds && body.data.beneficiaryIds.length > 0) {
    const seen = new Set<string>();
    for (const id of body.data.beneficiaryIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      const row = byId.get(id);
      if (row) batch.push(row);
    }
  } else if (typeof body.data.batchIndex === "number") {
    batchIndex = body.data.batchIndex;
    batch = sliceSurveyBroadcastBatch(
      targets,
      batchIndex,
      SURVEY_BROADCAST_BATCH_SIZE,
    );
  } else {
    return NextResponse.json(
      { error: "حدد batchIndex أو beneficiaryIds" },
      { status: 400 },
    );
  }

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

  for (let i = 0; i < batch.length; i++) {
    const b = batch[i]!;
    if (!b.mobile?.trim()) {
      failed++;
      errors.push({
        beneficiaryId: b.id,
        beneficiaryName: b.name,
        mobile: "",
        reason: "لا يوجد رقم جوال",
      });
    } else {
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
      } else {
        const waOpts = resolveSurveyWhatsAppOptions({
          audience: survey.audience,
          name: b.name,
          exhibitionName: exhibition.name,
          surveyUrl: delivery.url,
          surveyZadTemplateId: wa.surveyZadTemplateId,
          surveyHeaderImageUrl: wa.surveyHeaderImageUrl,
        });
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
          mediaUrl: waOpts.mediaUrl,
          templateParams: waOpts.templateParams,
          templateIdOverride: waOpts.templateIdOverride,
          surveyId: survey.id,
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
    }

    if (i < batch.length - 1) {
      await sleep(1000);
    }
  }

  const status = statusFromSendCounts({ sent, failed, stubbed });
  const statusReason =
    errors.length > 0
      ? errors
          .slice(0, 5)
          .map((e) => `${e.beneficiaryName}: ${e.reason}`)
          .join(" | ")
      : batch.length === 0
        ? "الدفعة فارغة أو سبق إرسالها"
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
      batchIndex,
      batchSize: batch.length,
      includePreviouslySent,
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
    batchIndex,
    batchSize: batch.length,
    remainingAfter: Math.max(0, targets.length - batch.length),
    status,
    statusReason,
  });
}

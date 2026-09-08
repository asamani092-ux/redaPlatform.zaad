"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  SURVEY_BROADCAST_BATCH_SIZE,
  buildSurveyBroadcastBatches,
  sliceSurveyBroadcastBatch,
  type SurveyBroadcastBatch,
} from "@/lib/survey-broadcast-batches";

type BroadcastPreview = {
  surveyId: string;
  surveyTitle: string;
  audienceLabel: string;
  batchSize: number;
  remaining: number;
  batches: SurveyBroadcastBatch[];
  orderedIds: string[];
  includePreviouslySent: boolean;
};

type SendResult = {
  sent: number;
  failed: number;
  stubbed: number;
  batchIndex: number;
  statusReason?: string | null;
};

/**
 * نافذة دفعات إرسال الاستبيان (200 لكل دفعة).
 * Time: O(b) لعرض الدفعات — Space: O(n) للمعرّفات المرتبة.
 */
export function SurveyBroadcastBatchesModal({
  open,
  surveyId,
  surveyTitle,
  onClose,
  onToast,
}: {
  open: boolean;
  surveyId: string | null;
  surveyTitle: string;
  onClose: () => void;
  onToast: (input: {
    title: string;
    body?: string;
    tone: "success" | "danger" | "warning";
  }) => void;
}) {
  const [preview, setPreview] = useState<BroadcastPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [sendingIndex, setSendingIndex] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<SendResult | null>(null);
  const [includePreviouslySent, setIncludePreviouslySent] = useState(false);
  const [resendConfirmOpen, setResendConfirmOpen] = useState(false);
  const [loadError, setLoadError] = useState("");

  const applyPreview = useCallback(
    (json: Record<string, unknown>, include: boolean) => {
      const orderedIds = Array.isArray(json.orderedIds)
        ? (json.orderedIds as unknown[]).filter(
            (id): id is string => typeof id === "string" && !!id,
          )
        : [];
      const batches =
        Array.isArray(json.batches) && (json.batches as SurveyBroadcastBatch[]).length
          ? (json.batches as SurveyBroadcastBatch[])
          : buildSurveyBroadcastBatches(orderedIds.length);
      setIncludePreviouslySent(include);
      setPreview({
        surveyId: String(json.surveyId ?? ""),
        surveyTitle: String(json.surveyTitle || surveyTitle),
        audienceLabel: String(json.audienceLabel || ""),
        batchSize: Number(json.batchSize ?? SURVEY_BROADCAST_BATCH_SIZE),
        remaining: orderedIds.length,
        batches,
        orderedIds,
        includePreviouslySent: include,
      });
    },
    [surveyTitle],
  );

  const loadPreview = useCallback(
    async (opts?: { includePreviouslySent?: boolean }) => {
      if (!surveyId) return;
      const include = opts?.includePreviouslySent ?? includePreviouslySent;
      setBusy(true);
      setLoadError("");
      const qs = new URLSearchParams({
        surveyId,
        ...(include ? { includePreviouslySent: "1" } : {}),
      });
      const res = await fetch(`/api/survey/broadcast?${qs.toString()}`);
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      setBusy(false);
      if (!res.ok) {
        setPreview(null);
        setLoadError(String(json.error || "تعذّر تحميل الدفعات"));
        onToast({
          title: "تعذّر تحميل الدفعات",
          body: String(json.error || "حاول مرة أخرى"),
          tone: "danger",
        });
        return;
      }
      applyPreview(json, include);
    },
    [surveyId, includePreviouslySent, onToast, applyPreview],
  );

  useEffect(() => {
    if (!open || !surveyId) {
      setPreview(null);
      setLastResult(null);
      setLoadError("");
      setIncludePreviouslySent(false);
      setSendingIndex(null);
      return;
    }
    void loadPreview({ includePreviouslySent: false });
    // تحميل أولي عند الفتح فقط
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, surveyId]);

  async function sendBatch(batchIndex: number) {
    if (!surveyId || !preview || sendingIndex != null) return;
    const beneficiaryIds = sliceSurveyBroadcastBatch(
      preview.orderedIds,
      batchIndex,
      preview.batchSize,
    );
    if (!beneficiaryIds.length) {
      onToast({ title: "الدفعة فارغة", tone: "warning" });
      return;
    }
    setSendingIndex(batchIndex);
    setLastResult(null);
    const res = await fetch("/api/survey/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        surveyId,
        batchIndex,
        beneficiaryIds,
        includePreviouslySent,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSendingIndex(null);
    if (!res.ok) {
      onToast({
        title: "فشل إرسال الدفعة",
        body: String(json.error || "حاول مرة أخرى"),
        tone: "danger",
      });
      return;
    }
    const result: SendResult = {
      sent: Number(json.sent ?? 0),
      failed: Number(json.failed ?? 0),
      stubbed: Number(json.stubbed ?? 0),
      batchIndex: Number(json.batchIndex ?? batchIndex),
      statusReason: json.statusReason ?? null,
    };
    setLastResult(result);
    onToast({
      title: `دفعة ${batchIndex + 1}`,
      body:
        `نجح ${result.sent} — فشل ${result.failed}` +
        (result.stubbed ? ` — تجريبي ${result.stubbed}` : ""),
      tone: result.failed > 0 ? "warning" : "success",
    });

    // إزالة من أُرسلت دفعتهم من القائمة المحلية (يمنع التكرار في وضع إعادة الإرسال)
    const sentSet = new Set(beneficiaryIds);
    setPreview((prev) => {
      if (!prev) return prev;
      const orderedIds = prev.orderedIds.filter((id) => !sentSet.has(id));
      return {
        ...prev,
        orderedIds,
        remaining: orderedIds.length,
        batches: buildSurveyBroadcastBatches(orderedIds.length, prev.batchSize),
      };
    });
  }

  return (
    <>
      <Modal
        open={open}
        title={`إرسال على دفعات: ${preview?.surveyTitle || surveyTitle}`}
        onClose={() => {
          if (sendingIndex != null) return;
          onClose();
        }}
        wide
      >
        <div className="stack gap-3">
          {preview ? (
            <p className="muted" style={{ margin: 0 }}>
              الفئة: <strong>{preview.audienceLabel}</strong>
              {" — "}
              متبقٍ: <strong>{preview.remaining}</strong>
              {" — "}
              حجم الدفعة: <strong>{preview.batchSize}</strong>
              {preview.includePreviouslySent ? (
                <span> — وضع إعادة الإرسال للكل</span>
              ) : null}
            </p>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              {busy ? "جاري تحميل الدفعات…" : loadError || "لا بيانات"}
            </p>
          )}

          {lastResult ? (
            <p className="muted" style={{ margin: 0 }}>
              آخر دفعة ({lastResult.batchIndex + 1}): نجح {lastResult.sent} / فشل{" "}
              {lastResult.failed}
              {lastResult.statusReason ? ` — ${lastResult.statusReason}` : ""}
            </p>
          ) : null}

          <div className="row wrap gap-2">
            <button
              type="button"
              className="btn-secondary"
              disabled={busy || sendingIndex != null || !surveyId}
              onClick={() => void loadPreview({ includePreviouslySent: false })}
            >
              إنشاء قائمة جديدة
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy || sendingIndex != null || !surveyId}
              onClick={() => void loadPreview({ includePreviouslySent })}
            >
              تحديث القائمة
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy || sendingIndex != null || !surveyId}
              onClick={() => setResendConfirmOpen(true)}
            >
              إعادة إرسال للكل
            </button>
          </div>

          {preview && preview.batches.length === 0 ? (
            <p style={{ margin: 0 }}>
              لا متبقين للإرسال. يمكنك «إنشاء قائمة جديدة» لالتقاط مستفيدين جدد، أو
              «إعادة إرسال للكل» لإعادة بناء الدفعات بمن أُرسل لهم سابقاً.
            </p>
          ) : null}

          {preview && preview.batches.length > 0 ? (
            <ul
              className="stack gap-2"
              style={{ listStyle: "none", padding: 0, margin: 0 }}
            >
              {preview.batches.map((batch) => {
                const sending = sendingIndex === batch.index;
                return (
                  <li
                    key={batch.index}
                    className="row wrap"
                    style={{
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "0.75rem",
                      border: "1px solid var(--border, #ddd)",
                      borderRadius: 8,
                      padding: "0.75rem 1rem",
                    }}
                  >
                    <span>
                      دفعة {batch.index + 1}{" "}
                      <span className="muted">({batch.size} مستفيداً)</span>
                      {sending ? (
                        <span className="muted">
                          {" "}
                          — جاري الإرسال… قد يستغرق حتى {batch.size} ثانية
                        </span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={busy || sendingIndex != null}
                      onClick={() => void sendBatch(batch.index)}
                    >
                      {sending ? "جاري…" : "إرسال هذه الدفعة"}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={resendConfirmOpen}
        title="إعادة إرسال للكل"
        body="ستُبنى دفعات من كامل الفئة بما فيهم من أُرسل لهم سابقاً. هل تريد المتابعة؟"
        confirmLabel="متابعة"
        destructive
        busy={busy || sendingIndex != null}
        onClose={() => setResendConfirmOpen(false)}
        onConfirm={() => {
          setResendConfirmOpen(false);
          setIncludePreviouslySent(true);
          void loadPreview({ includePreviouslySent: true });
        }}
      />
    </>
  );
}

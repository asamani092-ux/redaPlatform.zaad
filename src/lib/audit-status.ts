export type AuditStatus = "SUCCESS" | "FAILED" | "PARTIAL";

export function auditStatusLabel(status: AuditStatus | string | null | undefined): string {
  switch (status) {
    case "SUCCESS":
      return "نجاح";
    case "FAILED":
      return "فشل";
    case "PARTIAL":
      return "جزئي";
    default:
      return "—";
  }
}

export function resolveAuditStatus(
  meta: Record<string, unknown> | null | undefined
): { status: AuditStatus | null; statusReason: string | null } {
  if (!meta) return { status: null, statusReason: null };
  const status =
    typeof meta.status === "string" &&
    (meta.status === "SUCCESS" || meta.status === "FAILED" || meta.status === "PARTIAL")
      ? meta.status
      : null;
  const statusReason =
    typeof meta.statusReason === "string" && meta.statusReason.trim()
      ? meta.statusReason.trim()
      : null;
  return { status, statusReason };
}

/** Derive status from WhatsApp-style counters when not set explicitly. */
export function statusFromSendCounts(input: {
  sent: number;
  failed: number;
  stubbed?: number;
  skipped?: number;
}): AuditStatus {
  const failed = input.failed;
  const ok = input.sent + (input.stubbed ?? 0);
  if (failed > 0 && ok > 0) return "PARTIAL";
  if (failed > 0 && ok === 0) return "FAILED";
  return "SUCCESS";
}

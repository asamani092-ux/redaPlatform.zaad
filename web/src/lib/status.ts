export type BeneficiaryExhibitionStatus =
  | "NOT_INVITED"
  | "INVITED"
  | "ATTENDED"
  | "ATTENDED_EXCEPTION"
  | "RECEIVED";

export function resolveStatus(input: {
  invited?: boolean | null;
  attendanceType?: "NORMAL" | "EXCEPTION" | null;
  received?: boolean;
}): BeneficiaryExhibitionStatus {
  if (input.received) return "RECEIVED";
  if (input.attendanceType === "EXCEPTION") return "ATTENDED_EXCEPTION";
  if (input.attendanceType === "NORMAL") return "ATTENDED";
  if (input.invited) return "INVITED";
  return "NOT_INVITED";
}

export const STATUS_LABELS: Record<BeneficiaryExhibitionStatus, string> = {
  NOT_INVITED: "غير مدعو",
  INVITED: "مدعو",
  ATTENDED: "حضر — لم يستلم",
  ATTENDED_EXCEPTION: "حضر باستثناء",
  RECEIVED: "استلم",
};

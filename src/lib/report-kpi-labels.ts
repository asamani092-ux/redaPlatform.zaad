/**
 * تسميات مؤشرات التقارير ومنشئ العرض — مصدر واحد للنصوص.
 * فلترة مؤشرات العرض تعتمد المساواة النصية الحرفية مع label.
 */

export const REPORT_KPI_LABELS = {
  totalIndividuals: "إجمالي الأفراد (مستفيد + تابعون)",
  registeredFamilies: "الأسر المسجّلة",
  invitedFamilies: "الأسر المدعوّة",
  attendedFamilies: "الأسر الحاضرة",
  attendedIndividuals: "الأفراد الحاضرون (مستفيد + تابعون)",
  receivedFamilies: "الأسر المستلِمة",
  receivedIndividuals: "الأفراد المستلِمون (مستفيد + تابعون)",
  attendedNotReceived: "أسر حضرت ولم تستلم",
  attendanceFromInvitedPct: "نسبة الأسر الحاضرة من المدعوّة",
  receivedFromAttendedPct: "نسبة الأسر المستلِمة من الحاضرة",
  piecesDispensed: "إجمالي القطع المصروفة",
  clothesPieces: "الملابس المصروفة (قطع)",
  fabricMeters: "الأقمشة المصروفة (متر)",
  repeatDispenseFamilies: "أسر بصرف متكرر",
  attendanceByHour: "توزيع الحضور حسب الساعة",
  platformRemaining: "متبقي مخزون المنصة",
  storeContributed: "مساهمات المتاجر (كمية)",
  volunteers: "المتطوعون",
  exceptionAttendance: "حضور استثنائي (أسر)",
  overrideDispenses: "صرف استثنائي (أوامر)",
  inventoryRemaining: "متبقي المخزون (إجمالي)",
  inventoryRemainingExhibition: "متبقي المخزون (إجمالي المعرض)",
  platformContributed: "مضاف من المنصة",
  platformDispensed: "مصروف من المنصة",
  platformRemainingExhibition: "متبقي للمنصة (إجمالي المعرض)",
  storeDispensed: "مصروف من المتاجر",
  storeRemaining: "متبقي للمتاجر",
  storeRemainingExhibition: "متبقي للمتاجر (إجمالي المعرض)",
} as const;

export type ReportKpiLabelKey = keyof typeof REPORT_KPI_LABELS;

/** خيارات مؤشرات منشئ العرض — يجب أن تطابق label في buildZadPresentationReport */
export const PRESENTATION_KPI_OPTIONS = [
  REPORT_KPI_LABELS.totalIndividuals,
  REPORT_KPI_LABELS.registeredFamilies,
  REPORT_KPI_LABELS.invitedFamilies,
  REPORT_KPI_LABELS.attendedFamilies,
  REPORT_KPI_LABELS.receivedFamilies,
  REPORT_KPI_LABELS.receivedIndividuals,
  REPORT_KPI_LABELS.attendedNotReceived,
  REPORT_KPI_LABELS.attendanceFromInvitedPct,
  REPORT_KPI_LABELS.receivedFromAttendedPct,
  REPORT_KPI_LABELS.piecesDispensed,
  REPORT_KPI_LABELS.clothesPieces,
  REPORT_KPI_LABELS.fabricMeters,
  REPORT_KPI_LABELS.repeatDispenseFamilies,
  REPORT_KPI_LABELS.platformRemaining,
  REPORT_KPI_LABELS.storeContributed,
] as const;

export const FUNNEL_NOTE =
  "النسبة محسوبة على الأسر؛ الأفراد للتوضيح";

export const FUNNEL_STAGE_LABELS = {
  registered: "مسجّلون",
  invited: "مدعوون",
  attended: "حضور",
  received: "استلام",
} as const;

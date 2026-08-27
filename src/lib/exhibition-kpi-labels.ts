import type { ExhibitionKpiSections } from "@/lib/exhibition-kpis";
import type { KpiSectionBlock } from "@/components/ui/KpiSections";

export type KpiTile = { label: string; value: number };

/** تحويل مؤشرات المعرض إلى أقسام عربية للعرض — O(1) */
export function exhibitionKpisToSections(kpis: ExhibitionKpiSections): KpiSectionBlock[] {
  return [
    {
      title: "الحضور",
      items: [
        { label: "الأسر", value: kpis.attendance.families },
        { label: "الأفراد", value: kpis.attendance.individuals },
      ],
    },
    {
      title: "المصروف",
      items: [
        { label: "الملابس (قطع)", value: kpis.dispensed.clothesPieces },
        { label: "الأقمشة (متر)", value: kpis.dispensed.fabricMeters },
      ],
    },
    {
      title: "الشراكات",
      items: [
        { label: "الجمعيات الشريكة", value: kpis.partnerships.partnerAssociations },
        { label: "الأسر المستفيدة من الجمعيات", value: kpis.partnerships.associationFamilies },
      ],
    },
    {
      title: "المتطوعون",
      items: [{ label: "عدد المتطوعين", value: kpis.volunteers.count }],
    },
  ];
}

/** شبكة KPI مسطحة للداشبورد — O(1) */
export function exhibitionKpisToTiles(kpis: ExhibitionKpiSections): KpiTile[] {
  return exhibitionKpisToSections(kpis).flatMap((section) =>
    section.items.map((item) => ({
      label: section.items.length === 1 ? item.label : `${section.title} — ${item.label}`,
      value: Number(item.value),
    })),
  );
}

/** نصوص بطاقات العرض الحي — عدّل هنا فقط */
export const LIVE_KPI_LABELS = {
  attendanceFamilies: "الأسر",
  attendanceIndividuals: "الأفراد",
  clothesPieces: "الملابس",
  fabricMeters: "الأقمشة - متر",
  partnerAssociations: "الجمعيات الشريكة",
  associationFamilies: "الأسر المستفيدة من الجمعيات",
  volunteers: "المتطوعون",
} as const;

/**
 * مصدر كل مؤشر (المنطق في buildExhibitionKpiSections — src/lib/exhibition-kpis.ts)
 * | المؤشر | المصدر |
 * | الأسر | عدد سجلات Attendance للمعرض النشط (سجل حضور = أسرة) |
 * | الأفراد | مجموع (1 + dependentsCount) لكل حاضر من Beneficiary |
 * | الملابس | مجموع كميات DispenseLine حيث نوع=ملابس أو وحدة=قطعة |
 * | الأقمشة | مجموع كميات DispenseLine حيث نوع=قماش أو وحدة=متر |
 * | الجمعيات الشريكة | عدد الجمعيات المميزة (associationId أو associationOther) بين الحاضرين |
 * | الأسر المستفيدة من الجمعيات | عدد الحاضرين المرتبطين بجمعية (معرّف أو نص آخر) |
 * | المتطوعون | عدد سجلات Volunteer للمعرض النشط |
 */
export const LIVE_KPI_SOURCES: Record<keyof typeof LIVE_KPI_LABELS, string> = {
  attendanceFamilies: "جدول Attendance — عدد سجلات الحضور للمعرض",
  attendanceIndividuals:
    "جدول Attendance + Beneficiary.dependentsCount — مجموع أفراد الأسر الحاضرة",
  clothesPieces:
    "جدول DispenseLine + InventoryItem.attributes (type=ملابس أو unit=قطعة) — مجموع الكميات المصروفة",
  fabricMeters:
    "جدول DispenseLine + InventoryItem.attributes (type=قماش أو unit=متر) — مجموع الأمتار المصروفة",
  partnerAssociations:
    "جدول Attendance + Beneficiary.associationId / associationOther — عدد الجمعيات المميزة بين الحاضرين",
  associationFamilies:
    "جدول Attendance + Beneficiary — عدد الأسر الحاضرة المرتبطة بجمعية",
  volunteers: "جدول Volunteer — عدد المتطوعين المسجّلين في المعرض النشط",
};

/** بطاقات العرض الحي بلا تصنيف (حضور/مصروف/…) — O(1) */
export function exhibitionKpisToLiveTiles(kpis: ExhibitionKpiSections): KpiTile[] {
  return [
    { label: LIVE_KPI_LABELS.attendanceFamilies, value: kpis.attendance.families },
    { label: LIVE_KPI_LABELS.attendanceIndividuals, value: kpis.attendance.individuals },
    { label: LIVE_KPI_LABELS.clothesPieces, value: kpis.dispensed.clothesPieces },
    { label: LIVE_KPI_LABELS.fabricMeters, value: kpis.dispensed.fabricMeters },
    { label: LIVE_KPI_LABELS.partnerAssociations, value: kpis.partnerships.partnerAssociations },
    { label: LIVE_KPI_LABELS.associationFamilies, value: kpis.partnerships.associationFamilies },
    { label: LIVE_KPI_LABELS.volunteers, value: kpis.volunteers.count },
  ];
}

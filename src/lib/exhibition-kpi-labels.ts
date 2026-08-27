import type { ExhibitionKpiSections } from "@/lib/exhibition-kpis";
import type { KpiSectionBlock } from "@/components/ui/KpiSections";

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

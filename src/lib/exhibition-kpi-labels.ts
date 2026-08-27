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

/** شبكة KPI مسطحة (التصميم السابق) — O(1) */
export function exhibitionKpisToTiles(kpis: ExhibitionKpiSections): KpiTile[] {
  return exhibitionKpisToSections(kpis).flatMap((section) =>
    section.items.map((item) => ({
      label: section.items.length === 1 ? item.label : `${section.title} — ${item.label}`,
      value: Number(item.value),
    })),
  );
}

import { KpiCard } from "@/components/ui/KpiCard";

export type KpiSectionItem = {
  label: string;
  value: string | number;
};

export type KpiSectionBlock = {
  title: string;
  items: KpiSectionItem[];
};

export function KpiSections({ sections }: { sections: KpiSectionBlock[] }) {
  return (
    <div className="kpi-sections">
      {sections.map((section) => (
        <section key={section.title} className="kpi-section">
          <h2 className="kpi-section__title">{section.title}</h2>
          <div className="stat-grid">
            {section.items.map((item) => (
              <KpiCard key={item.label} label={item.label} value={item.value} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

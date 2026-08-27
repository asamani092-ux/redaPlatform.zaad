import { prisma } from "@/lib/prisma";
import { householdSize } from "@/lib/report-metrics";

export type ExhibitionKpiSections = {
  attendance: {
    families: number;
    individuals: number;
  };
  dispensed: {
    clothesPieces: number;
    fabricMeters: number;
  };
  partnerships: {
    partnerAssociations: number;
    associationFamilies: number;
  };
  volunteers: {
    count: number;
  };
};

function dispenseKind(attrs: Record<string, unknown>): "clothes" | "fabric" | "other" {
  const type = String(attrs.type ?? "").trim();
  const unit = String(attrs.unit ?? "").trim();
  if (type.includes("ملابس") || unit === "قطعة") return "clothes";
  if (type.includes("قماش") || unit === "متر") return "fabric";
  return "other";
}

/** مؤشرات المعرض المجمّعة للداشبورد والعرض الحي — Time O(a+d)، Space O(a)
 *  الحساب: src/lib/exhibition-kpis.ts
 *  النصوص: src/lib/exhibition-kpi-labels.ts (LIVE_KPI_LABELS / LIVE_KPI_SOURCES)
 */
export async function buildExhibitionKpiSections(
  exhibitionId: string,
): Promise<ExhibitionKpiSections> {
  const [attendances, dispenseLines, volunteers] = await Promise.all([
    prisma.attendance.findMany({
      where: { exhibitionId },
      select: {
        beneficiary: {
          select: {
            dependentsCount: true,
            associationId: true,
            associationOther: true,
          },
        },
      },
    }),
    prisma.dispenseLine.findMany({
      where: { dispenseOrder: { exhibitionId } },
      select: {
        quantity: true,
        inventoryItem: { select: { attributesJson: true } },
      },
    }),
    prisma.volunteer.count({ where: { exhibitionId } }),
  ]);

  let clothesPieces = 0;
  let fabricMeters = 0;
  for (const line of dispenseLines) {
    const qty = Number(line.quantity);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const attrs = (line.inventoryItem.attributesJson ?? {}) as Record<string, unknown>;
    const kind = dispenseKind(attrs);
    if (kind === "fabric") fabricMeters += qty;
    else clothesPieces += qty;
  }

  const partnerAssociationKeys = new Set<string>();
  let associationFamilies = 0;
  let attendanceIndividuals = 0;

  for (const row of attendances) {
    const b = row.beneficiary;
    attendanceIndividuals += householdSize(b.dependentsCount ?? 0);
    const other = b.associationOther?.trim();
    if (b.associationId) {
      partnerAssociationKeys.add(`id:${b.associationId}`);
      associationFamilies += 1;
    } else if (other) {
      partnerAssociationKeys.add(`other:${other}`);
      associationFamilies += 1;
    }
  }

  return {
    attendance: {
      families: attendances.length,
      individuals: attendanceIndividuals,
    },
    dispensed: {
      clothesPieces: Math.round(clothesPieces * 1000) / 1000,
      fabricMeters: Math.round(fabricMeters * 1000) / 1000,
    },
    partnerships: {
      partnerAssociations: partnerAssociationKeys.size,
      associationFamilies,
    },
    volunteers: { count: volunteers },
  };
}

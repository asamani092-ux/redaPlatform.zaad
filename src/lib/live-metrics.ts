import { prisma } from "@/lib/prisma";
import { countDistinctReceived } from "@/lib/report-counts";
import { buildExhibitionKpiSections } from "@/lib/exhibition-kpis";
import {
  attributeLabelsFromSchema,
  parseInventorySchema,
} from "@/lib/inventory-schema";

/** مؤشرات العرض الحي بلا PII — O(a+d) تجميعات المعرض */
export async function buildLiveMetrics(exhibitionId: string) {
  const exhibition = await prisma.exhibition.findUnique({
    where: { id: exhibitionId },
    select: {
      id: true,
      name: true,
      location: true,
      active: true,
      settings: { select: { inventorySchemaJson: true } },
    },
  });
  if (!exhibition) return null;

  const [attended, received, exhibitionKpis] = await Promise.all([
    prisma.attendance.count({ where: { exhibitionId } }),
    countDistinctReceived(exhibitionId),
    buildExhibitionKpiSections(exhibitionId),
  ]);
  const completionRate =
    attended > 0 ? Math.min(100, Math.round((received / attended) * 100)) : 0;

  const { settings, ...exhibitionPublic } = exhibition;

  return {
    exhibition: exhibitionPublic,
    updatedAt: new Date().toISOString(),
    stats: {
      completionRate,
    },
    exhibitionKpis,
    attributeLabels: attributeLabelsFromSchema(
      parseInventorySchema(settings?.inventorySchemaJson),
    ),
  };
}

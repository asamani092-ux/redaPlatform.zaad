import { prisma } from "@/lib/prisma";
import {
  DEFAULT_INVENTORY_SCHEMA,
  parseInventorySchema,
  type InventorySchemaField,
} from "@/lib/inventory-schema";

export { DEFAULT_INVENTORY_SCHEMA, parseInventorySchema };
export type { InventorySchemaField };

export function normalizeExhibitionName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export async function getActiveExhibition() {
  return prisma.exhibition.findFirst({
    where: { active: true },
    include: { settings: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function requireActiveExhibition() {
  const exhibition = await getActiveExhibition();
  if (!exhibition) {
    throw new Error("لا يوجد معرض نشط — أنشئ أو فعّل معرضاً من إدارة المعارض");
  }
  return exhibition;
}

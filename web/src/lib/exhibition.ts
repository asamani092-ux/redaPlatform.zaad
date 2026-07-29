import { prisma } from "@/lib/prisma";

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
    throw new Error("لا يوجد معرض نشط");
  }
  return exhibition;
}

export type InventorySchemaField = {
  key: string;
  label: string;
  type: "text" | "number";
};

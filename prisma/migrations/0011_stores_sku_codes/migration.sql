-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "exhibitionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN "skuCode" TEXT;

-- Backfill unique 4-digit codes per exhibition (1100+)
WITH numbered AS (
  SELECT id,
         "exhibitionId",
         1100 + ROW_NUMBER() OVER (PARTITION BY "exhibitionId" ORDER BY "createdAt") AS n
  FROM "InventoryItem"
)
UPDATE "InventoryItem" i
SET "skuCode" = CASE
  WHEN numbered.n <= 9999 THEN LPAD(numbered.n::text, 4, '0')
  ELSE numbered.n::text
END
FROM numbered
WHERE i.id = numbered.id;

UPDATE "InventoryItem" SET "skuCode" = '1100' WHERE "skuCode" IS NULL;

ALTER TABLE "InventoryItem" ALTER COLUMN "skuCode" SET NOT NULL;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN "storeId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_exhibitionId_skuCode_key" ON "InventoryItem"("exhibitionId", "skuCode");

-- CreateIndex
CREATE UNIQUE INDEX "Store_exhibitionId_name_key" ON "Store"("exhibitionId", "name");

-- CreateIndex
CREATE INDEX "Store_exhibitionId_active_idx" ON "Store"("exhibitionId", "active");

-- CreateIndex
CREATE INDEX "StockMovement_storeId_idx" ON "StockMovement"("storeId");

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_exhibitionId_fkey" FOREIGN KEY ("exhibitionId") REFERENCES "Exhibition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

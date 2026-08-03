-- وحدة لكل تابع افتراضياً: الكامل = الأساسي + التابعون × 1
ALTER TABLE "public"."ExhibitionSettings"
  ALTER COLUMN "dependentsEntitlement" SET DEFAULT 1;

UPDATE "public"."ExhibitionSettings"
SET "dependentsEntitlement" = 1
WHERE "dependentsEntitlement" = 0;

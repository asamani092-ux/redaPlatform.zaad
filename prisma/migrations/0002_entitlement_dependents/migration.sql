-- Rename entitledPieces → baseEntitlement (per-exhibition editable base)
ALTER TABLE "public"."ExhibitionSettings"
  RENAME COLUMN "entitledPieces" TO "baseEntitlement";

-- Dependents / family size on beneficiary
ALTER TABLE "public"."Beneficiary"
  ADD COLUMN "dependentsCount" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Beneficiary_dependentsCount_idx" ON "public"."Beneficiary"("dependentsCount");

-- Reuse DispenseOrder.entitledOverride + overrideReason:
-- override without a real (non-blank) reason is rejected at DB level
ALTER TABLE "public"."DispenseOrder"
  ADD CONSTRAINT "DispenseOrder_override_reason_required"
  CHECK (
    "entitledOverride" IS NULL
    OR (
      "overrideReason" IS NOT NULL
      AND length(btrim("overrideReason")) > 0
    )
  );

-- Cap piecesCount to effective entitlement (or explicit override) at DB level
CREATE OR REPLACE FUNCTION "public"."enforce_dispense_entitlement"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  base_ent integer;
  deps integer;
  effective integer;
BEGIN
  IF NEW."entitledOverride" IS NOT NULL THEN
    IF NEW."overrideReason" IS NULL OR length(btrim(NEW."overrideReason")) = 0 THEN
      RAISE EXCEPTION 'سبب استثناء الاستحقاق مطلوب ولا يمكن أن يكون فارغاً'
        USING ERRCODE = 'check_violation';
    END IF;
    effective := NEW."entitledOverride";
  ELSE
    SELECT s."baseEntitlement" INTO base_ent
    FROM "public"."ExhibitionSettings" s
    WHERE s."exhibitionId" = NEW."exhibitionId";

    SELECT b."dependentsCount" INTO deps
    FROM "public"."Beneficiary" b
    WHERE b."id" = NEW."beneficiaryId";

    effective := GREATEST(COALESCE(base_ent, 1), COALESCE(deps, 0));
  END IF;

  IF NEW."piecesCount" > effective THEN
    RAISE EXCEPTION 'تجاوز الاستحقاق الفعلي (%) — المطلوب %', effective, NEW."piecesCount"
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "trg_enforce_dispense_entitlement" ON "public"."DispenseOrder";
CREATE TRIGGER "trg_enforce_dispense_entitlement"
  BEFORE INSERT OR UPDATE OF "piecesCount", "entitledOverride", "overrideReason", "exhibitionId", "beneficiaryId"
  ON "public"."DispenseOrder"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."enforce_dispense_entitlement"();

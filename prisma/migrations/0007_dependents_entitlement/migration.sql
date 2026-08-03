-- Per-dependent entitlement setting; full = base + dependents × perDependent
ALTER TABLE "public"."ExhibitionSettings"
  ADD COLUMN IF NOT EXISTS "dependentsEntitlement" INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION "public"."enforce_dispense_entitlement"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  base_ent integer;
  per_dep integer;
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
    SELECT s."baseEntitlement", s."dependentsEntitlement"
      INTO base_ent, per_dep
    FROM "public"."ExhibitionSettings" s
    WHERE s."exhibitionId" = NEW."exhibitionId";

    SELECT b."dependentsCount" INTO deps
    FROM "public"."Beneficiary" b
    WHERE b."id" = NEW."beneficiaryId";

    effective := COALESCE(base_ent, 1) + COALESCE(deps, 0) * COALESCE(per_dep, 0);
  END IF;

  IF NEW."piecesCount" > effective THEN
    RAISE EXCEPTION 'تجاوز الاستحقاق الفعلي (%) — المطلوب %', effective, NEW."piecesCount"
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

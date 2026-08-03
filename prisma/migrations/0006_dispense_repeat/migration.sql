-- Allow multiple dispense orders per beneficiary (exception re-dispense)
DROP INDEX IF EXISTS "DispenseOrder_exhibitionId_beneficiaryId_key";
CREATE INDEX IF NOT EXISTS "DispenseOrder_exhibitionId_beneficiaryId_idx" ON "DispenseOrder"("exhibitionId", "beneficiaryId");

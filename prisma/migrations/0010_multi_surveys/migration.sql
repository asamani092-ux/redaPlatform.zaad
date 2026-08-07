-- AlterTable: دعم ردود لأكثر من استبيان لكل مستفيد
ALTER TABLE "SurveyResponse" ADD COLUMN IF NOT EXISTS "surveyId" TEXT NOT NULL DEFAULT 'default';

-- DropIndex
DROP INDEX IF EXISTS "SurveyResponse_exhibitionId_beneficiaryId_key";

-- CreateIndex
CREATE UNIQUE INDEX "SurveyResponse_exhibitionId_beneficiaryId_surveyId_key"
  ON "SurveyResponse"("exhibitionId", "beneficiaryId", "surveyId");

-- CreateIndex
CREATE INDEX "SurveyResponse_exhibitionId_surveyId_idx"
  ON "SurveyResponse"("exhibitionId", "surveyId");

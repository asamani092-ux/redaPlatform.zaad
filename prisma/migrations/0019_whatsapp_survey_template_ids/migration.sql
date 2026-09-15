-- AlterTable
ALTER TABLE "AppConfig" ADD COLUMN IF NOT EXISTS "whatsappSurveyTemplateId" TEXT;
ALTER TABLE "AppConfig" ADD COLUMN IF NOT EXISTS "whatsappSurveyZadTemplateId" TEXT;

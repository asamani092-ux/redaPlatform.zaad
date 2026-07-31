-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."AttendanceType" AS ENUM ('NORMAL', 'EXCEPTION');

-- CreateEnum
CREATE TYPE "public"."Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "public"."OutboundMessageStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'STUBBED');

-- CreateEnum
CREATE TYPE "public"."OutboundMessageType" AS ENUM ('INVITATION', 'THANK_YOU', 'SURVEY');

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('ADMIN', 'REGISTRATION', 'RECEPTION', 'DISTRIBUTION', 'INVENTORY', 'REPORTS');

-- CreateEnum
CREATE TYPE "public"."StockMovementType" AS ENUM ('ADD', 'DISPENSE', 'RETURN');

-- CreateTable
CREATE TABLE "public"."AssociationOption" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssociationOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Attendance" (
    "id" TEXT NOT NULL,
    "exhibitionId" TEXT NOT NULL,
    "beneficiaryId" TEXT NOT NULL,
    "type" "public"."AttendanceType" NOT NULL DEFAULT 'NORMAL',
    "exceptionReason" TEXT,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedInById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Beneficiary" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nationalId" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "gender" "public"."Gender",
    "neighborhood" TEXT,
    "city" TEXT,
    "birthDate" TIMESTAMP(3),
    "notes" TEXT,
    "associationId" TEXT,
    "associationOther" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Beneficiary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DispenseLine" (
    "id" TEXT NOT NULL,
    "dispenseOrderId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,

    CONSTRAINT "DispenseLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DispenseOrder" (
    "id" TEXT NOT NULL,
    "exhibitionId" TEXT NOT NULL,
    "beneficiaryId" TEXT NOT NULL,
    "piecesCount" INTEGER NOT NULL,
    "entitledOverride" INTEGER,
    "overrideReason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DispenseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Exhibition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exhibition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExhibitionInvite" (
    "id" TEXT NOT NULL,
    "exhibitionId" TEXT NOT NULL,
    "beneficiaryId" TEXT NOT NULL,
    "qrToken" TEXT NOT NULL,
    "invited" BOOLEAN NOT NULL DEFAULT true,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invitedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExhibitionInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExhibitionSettings" (
    "id" TEXT NOT NULL,
    "exhibitionId" TEXT NOT NULL,
    "entitledPieces" INTEGER NOT NULL DEFAULT 1,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 10,
    "inventorySchemaJson" JSONB NOT NULL,
    "whatsappInviteTpl" TEXT,
    "whatsappThanksTpl" TEXT,
    "surveyQuestionsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExhibitionSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InventoryItem" (
    "id" TEXT NOT NULL,
    "exhibitionId" TEXT NOT NULL,
    "attributesJson" JSONB NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OutboundMessage" (
    "id" TEXT NOT NULL,
    "exhibitionId" TEXT,
    "beneficiaryId" TEXT,
    "type" "public"."OutboundMessageType" NOT NULL,
    "status" "public"."OutboundMessageStatus" NOT NULL DEFAULT 'PENDING',
    "payloadJson" JSONB,
    "providerRef" TEXT,
    "errorMessage" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboundMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StockMovement" (
    "id" TEXT NOT NULL,
    "exhibitionId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "type" "public"."StockMovementType" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SurveyResponse" (
    "id" TEXT NOT NULL,
    "exhibitionId" TEXT NOT NULL,
    "beneficiaryId" TEXT NOT NULL,
    "answersJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssociationOption_name_key" ON "public"."AssociationOption"("name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_exhibitionId_beneficiaryId_key" ON "public"."Attendance"("exhibitionId" ASC, "beneficiaryId" ASC);

-- CreateIndex
CREATE INDEX "Attendance_exhibitionId_checkedInAt_idx" ON "public"."Attendance"("exhibitionId" ASC, "checkedInAt" ASC);

-- CreateIndex
CREATE INDEX "Attendance_type_idx" ON "public"."Attendance"("type" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "public"."AuditLog"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "public"."AuditLog"("entityType" ASC, "entityId" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "public"."AuditLog"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "Beneficiary_associationId_idx" ON "public"."Beneficiary"("associationId" ASC);

-- CreateIndex
CREATE INDEX "Beneficiary_city_idx" ON "public"."Beneficiary"("city" ASC);

-- CreateIndex
CREATE INDEX "Beneficiary_mobile_idx" ON "public"."Beneficiary"("mobile" ASC);

-- CreateIndex
CREATE INDEX "Beneficiary_name_idx" ON "public"."Beneficiary"("name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Beneficiary_nationalId_key" ON "public"."Beneficiary"("nationalId" ASC);

-- CreateIndex
CREATE INDEX "DispenseLine_dispenseOrderId_idx" ON "public"."DispenseLine"("dispenseOrderId" ASC);

-- CreateIndex
CREATE INDEX "DispenseLine_inventoryItemId_idx" ON "public"."DispenseLine"("inventoryItemId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "DispenseOrder_exhibitionId_beneficiaryId_key" ON "public"."DispenseOrder"("exhibitionId" ASC, "beneficiaryId" ASC);

-- CreateIndex
CREATE INDEX "DispenseOrder_exhibitionId_createdAt_idx" ON "public"."DispenseOrder"("exhibitionId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "Exhibition_active_idx" ON "public"."Exhibition"("active" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Exhibition_name_key" ON "public"."Exhibition"("name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ExhibitionInvite_exhibitionId_beneficiaryId_key" ON "public"."ExhibitionInvite"("exhibitionId" ASC, "beneficiaryId" ASC);

-- CreateIndex
CREATE INDEX "ExhibitionInvite_exhibitionId_invited_idx" ON "public"."ExhibitionInvite"("exhibitionId" ASC, "invited" ASC);

-- CreateIndex
CREATE INDEX "ExhibitionInvite_qrToken_idx" ON "public"."ExhibitionInvite"("qrToken" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ExhibitionInvite_qrToken_key" ON "public"."ExhibitionInvite"("qrToken" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ExhibitionSettings_exhibitionId_key" ON "public"."ExhibitionSettings"("exhibitionId" ASC);

-- CreateIndex
CREATE INDEX "InventoryItem_exhibitionId_idx" ON "public"."InventoryItem"("exhibitionId" ASC);

-- CreateIndex
CREATE INDEX "OutboundMessage_exhibitionId_idx" ON "public"."OutboundMessage"("exhibitionId" ASC);

-- CreateIndex
CREATE INDEX "OutboundMessage_status_type_idx" ON "public"."OutboundMessage"("status" ASC, "type" ASC);

-- CreateIndex
CREATE INDEX "StockMovement_exhibitionId_createdAt_idx" ON "public"."StockMovement"("exhibitionId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "StockMovement_inventoryItemId_idx" ON "public"."StockMovement"("inventoryItemId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SurveyResponse_exhibitionId_beneficiaryId_key" ON "public"."SurveyResponse"("exhibitionId" ASC, "beneficiaryId" ASC);

-- CreateIndex
CREATE INDEX "SurveyResponse_exhibitionId_idx" ON "public"."SurveyResponse"("exhibitionId" ASC);

-- CreateIndex
CREATE INDEX "User_lastActiveAt_idx" ON "public"."User"("lastActiveAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_mobile_key" ON "public"."User"("mobile" ASC);

-- CreateIndex
CREATE INDEX "User_role_idx" ON "public"."User"("role" ASC);

-- AddForeignKey
ALTER TABLE "public"."Attendance" ADD CONSTRAINT "Attendance_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "public"."Beneficiary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Attendance" ADD CONSTRAINT "Attendance_checkedInById_fkey" FOREIGN KEY ("checkedInById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Attendance" ADD CONSTRAINT "Attendance_exhibitionId_fkey" FOREIGN KEY ("exhibitionId") REFERENCES "public"."Exhibition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Beneficiary" ADD CONSTRAINT "Beneficiary_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "public"."AssociationOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DispenseLine" ADD CONSTRAINT "DispenseLine_dispenseOrderId_fkey" FOREIGN KEY ("dispenseOrderId") REFERENCES "public"."DispenseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DispenseLine" ADD CONSTRAINT "DispenseLine_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "public"."InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DispenseOrder" ADD CONSTRAINT "DispenseOrder_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "public"."Beneficiary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DispenseOrder" ADD CONSTRAINT "DispenseOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DispenseOrder" ADD CONSTRAINT "DispenseOrder_exhibitionId_fkey" FOREIGN KEY ("exhibitionId") REFERENCES "public"."Exhibition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExhibitionInvite" ADD CONSTRAINT "ExhibitionInvite_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "public"."Beneficiary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExhibitionInvite" ADD CONSTRAINT "ExhibitionInvite_exhibitionId_fkey" FOREIGN KEY ("exhibitionId") REFERENCES "public"."Exhibition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExhibitionInvite" ADD CONSTRAINT "ExhibitionInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExhibitionSettings" ADD CONSTRAINT "ExhibitionSettings_exhibitionId_fkey" FOREIGN KEY ("exhibitionId") REFERENCES "public"."Exhibition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InventoryItem" ADD CONSTRAINT "InventoryItem_exhibitionId_fkey" FOREIGN KEY ("exhibitionId") REFERENCES "public"."Exhibition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OutboundMessage" ADD CONSTRAINT "OutboundMessage_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "public"."Beneficiary"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OutboundMessage" ADD CONSTRAINT "OutboundMessage_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OutboundMessage" ADD CONSTRAINT "OutboundMessage_exhibitionId_fkey" FOREIGN KEY ("exhibitionId") REFERENCES "public"."Exhibition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockMovement" ADD CONSTRAINT "StockMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockMovement" ADD CONSTRAINT "StockMovement_exhibitionId_fkey" FOREIGN KEY ("exhibitionId") REFERENCES "public"."Exhibition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockMovement" ADD CONSTRAINT "StockMovement_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "public"."InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SurveyResponse" ADD CONSTRAINT "SurveyResponse_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "public"."Beneficiary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SurveyResponse" ADD CONSTRAINT "SurveyResponse_exhibitionId_fkey" FOREIGN KEY ("exhibitionId") REFERENCES "public"."Exhibition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

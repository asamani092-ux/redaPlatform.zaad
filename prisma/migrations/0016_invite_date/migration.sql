-- AlterTable
ALTER TABLE "ExhibitionInvite" ADD COLUMN "inviteDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ExhibitionInvite_exhibitionId_inviteDate_idx" ON "ExhibitionInvite"("exhibitionId", "inviteDate");

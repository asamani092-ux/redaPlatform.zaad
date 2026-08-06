-- CreateTable
CREATE TABLE "LiveDisplayLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "exhibitionId" TEXT NOT NULL,
    "label" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "LiveDisplayLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LiveDisplayLink_token_key" ON "LiveDisplayLink"("token");

-- CreateIndex
CREATE INDEX "LiveDisplayLink_exhibitionId_createdAt_idx" ON "LiveDisplayLink"("exhibitionId", "createdAt");

-- CreateIndex
CREATE INDEX "LiveDisplayLink_revokedAt_idx" ON "LiveDisplayLink"("revokedAt");

-- AddForeignKey
ALTER TABLE "LiveDisplayLink" ADD CONSTRAINT "LiveDisplayLink_exhibitionId_fkey" FOREIGN KEY ("exhibitionId") REFERENCES "Exhibition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

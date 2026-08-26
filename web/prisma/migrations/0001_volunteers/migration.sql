-- CreateTable
CREATE TABLE "VolunteerRoleOption" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VolunteerRoleOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Volunteer" (
    "id" TEXT NOT NULL,
    "exhibitionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "nationalId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "thanksSentAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Volunteer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VolunteerRoleOption_name_key" ON "VolunteerRoleOption"("name");

-- CreateIndex
CREATE INDEX "Volunteer_exhibitionId_idx" ON "Volunteer"("exhibitionId");

-- CreateIndex
CREATE INDEX "Volunteer_roleId_idx" ON "Volunteer"("roleId");

-- CreateIndex
CREATE INDEX "Volunteer_mobile_idx" ON "Volunteer"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "Volunteer_exhibitionId_nationalId_key" ON "Volunteer"("exhibitionId", "nationalId");

-- AddForeignKey
ALTER TABLE "Volunteer" ADD CONSTRAINT "Volunteer_exhibitionId_fkey" FOREIGN KEY ("exhibitionId") REFERENCES "Exhibition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Volunteer" ADD CONSTRAINT "Volunteer_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "VolunteerRoleOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Volunteer" ADD CONSTRAINT "Volunteer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default roles (cumulative; skip if name exists)
INSERT INTO "VolunteerRoleOption" ("id", "name", "active", "sortOrder", "createdAt", "updatedAt")
VALUES
  (concat('cvr', substr(md5(random()::text), 1, 22)), 'تنظيم', true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('cvr', substr(md5(random()::text), 1, 22)), 'استقبال', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('cvr', substr(md5(random()::text), 1, 22)), 'صرف', true, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('cvr', substr(md5(random()::text), 1, 22)), 'مخزون', true, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

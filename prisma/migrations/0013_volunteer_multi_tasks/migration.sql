-- مهام متعددة لكل متطوع
CREATE TABLE "VolunteerTask" (
    "id" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VolunteerTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VolunteerTask_volunteerId_roleId_key" ON "VolunteerTask"("volunteerId", "roleId");
CREATE INDEX "VolunteerTask_volunteerId_idx" ON "VolunteerTask"("volunteerId");
CREATE INDEX "VolunteerTask_roleId_idx" ON "VolunteerTask"("roleId");

ALTER TABLE "VolunteerTask" ADD CONSTRAINT "VolunteerTask_volunteerId_fkey"
  FOREIGN KEY ("volunteerId") REFERENCES "Volunteer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VolunteerTask" ADD CONSTRAINT "VolunteerTask_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "VolunteerRoleOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ترحيل المهمة الواحدة السابقة
INSERT INTO "VolunteerTask" ("id", "volunteerId", "roleId", "createdAt")
SELECT concat('cvt', substr(md5("id" || "roleId"), 1, 22)), "id", "roleId", "createdAt"
FROM "Volunteer"
WHERE "roleId" IS NOT NULL;

ALTER TABLE "Volunteer" DROP CONSTRAINT "Volunteer_roleId_fkey";
DROP INDEX "Volunteer_roleId_idx";
ALTER TABLE "Volunteer" DROP COLUMN "roleId";

-- مهام افتراضية جديدة
INSERT INTO "VolunteerRoleOption" ("id", "name", "active", "sortOrder", "createdAt", "updatedAt")
VALUES
  (concat('cvr', substr(md5('vtask-1'), 1, 22)), 'التواصل مع الجهات', true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('cvr', substr(md5('vtask-2'), 1, 22)), 'فرز الملابس', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('cvr', substr(md5('vtask-3'), 1, 22)), 'ترتيب المعرض', true, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('cvr', substr(md5('vtask-4'), 1, 22)), 'تنظيم الأسر', true, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('cvr', substr(md5('vtask-5'), 1, 22)), 'استقبال الأسر', true, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('cvr', substr(md5('vtask-6'), 1, 22)), 'حصر الأسر', true, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('cvr', substr(md5('vtask-7'), 1, 22)), 'مساعدة الأسر', true, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('cvr', substr(md5('vtask-8'), 1, 22)), 'الضيافة', true, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO UPDATE SET "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = CURRENT_TIMESTAMP;

UPDATE "VolunteerRoleOption"
SET "active" = false, "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" IN ('تنظيم', 'استقبال', 'صرف', 'مخزون');

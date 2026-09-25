-- AlterTable
ALTER TABLE "courses" ADD COLUMN "service_type" VARCHAR(32) NOT NULL DEFAULT 'GROUP_120';

-- CreateIndex
CREATE INDEX "courses_service_type_idx" ON "courses"("service_type");

-- AlterTable
ALTER TABLE "courses" ADD COLUMN "course_type" VARCHAR(32) NOT NULL DEFAULT 'REGULAR';

-- CreateIndex
CREATE INDEX "courses_course_type_idx" ON "courses"("course_type");

-- AlterTable
ALTER TABLE "groups" ADD COLUMN "teacher_id" UUID,
ADD COLUMN "schedule_option_id" UUID;

-- CreateTable
CREATE TABLE "schedule_options" (
    "id" UUID NOT NULL,
    "day" VARCHAR(16) NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "schedule_options_is_active_idx" ON "schedule_options"("is_active");

-- CreateIndex
CREATE INDEX "schedule_options_day_start_time_idx" ON "schedule_options"("day", "start_time");

-- CreateIndex
CREATE INDEX "groups_teacher_id_idx" ON "groups"("teacher_id");

-- CreateIndex
CREATE INDEX "groups_schedule_option_id_idx" ON "groups"("schedule_option_id");

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_schedule_option_id_fkey" FOREIGN KEY ("schedule_option_id") REFERENCES "schedule_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Catalog permissions for schedule option CRUD
INSERT INTO "permissions" ("id", "module", "action", "created_at")
VALUES
  (gen_random_uuid(), 'schedules', 'read', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'schedules', 'create', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'schedules', 'update', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'schedules', 'delete', CURRENT_TIMESTAMP);

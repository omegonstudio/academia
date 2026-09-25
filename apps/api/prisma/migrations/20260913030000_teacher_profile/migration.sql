-- CreateTable
CREATE TABLE "teachers" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "first_name" VARCHAR(80) NOT NULL,
    "last_name" VARCHAR(80) NOT NULL,
    "level" VARCHAR(8) NOT NULL,
    "availability" VARCHAR(16) NOT NULL DEFAULT 'AVAILABLE',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teachers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teachers_user_id_key" ON "teachers"("user_id");

-- CreateIndex
CREATE INDEX "teachers_is_active_idx" ON "teachers"("is_active");

-- CreateIndex
CREATE INDEX "teachers_availability_idx" ON "teachers"("availability");

-- CreateIndex
CREATE INDEX "teachers_last_name_first_name_idx" ON "teachers"("last_name", "first_name");

-- AddForeignKey
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Extend catalog with teachers.delete for soft-deactivation via DELETE /teachers/:id
INSERT INTO "permissions" ("id", "module", "action", "created_at")
VALUES (gen_random_uuid(), 'teachers', 'delete', CURRENT_TIMESTAMP);

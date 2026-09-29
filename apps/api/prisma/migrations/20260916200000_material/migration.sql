-- CreateEnum
CREATE TYPE "material_kind" AS ENUM ('FILE', 'LINK');

-- CreateEnum
CREATE TYPE "material_upload_status" AS ENUM ('PENDING', 'READY');

-- CreateTable
CREATE TABLE "materials" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(1000),
    "kind" "material_kind" NOT NULL,
    "upload_status" "material_upload_status" NOT NULL,
    "mime_type" VARCHAR(100),
    "size_bytes" INTEGER,
    "storage_key" VARCHAR(512),
    "original_filename" VARCHAR(255),
    "external_url" VARCHAR(2048),
    "course_id" UUID,
    "class_session_id" UUID,
    "created_by_user_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- Exactly one association: Course XOR ClassSession (Prisma cannot express XOR).
ALTER TABLE "materials"
  ADD CONSTRAINT "materials_course_xor_session_check"
  CHECK (
    ("course_id" IS NOT NULL AND "class_session_id" IS NULL)
    OR
    ("course_id" IS NULL AND "class_session_id" IS NOT NULL)
  );

-- CreateIndex
CREATE UNIQUE INDEX "materials_storage_key_key" ON "materials"("storage_key");

-- CreateIndex
CREATE INDEX "materials_course_id_is_active_idx" ON "materials"("course_id", "is_active");

-- CreateIndex
CREATE INDEX "materials_class_session_id_is_active_idx" ON "materials"("class_session_id", "is_active");

-- CreateIndex
CREATE INDEX "materials_created_by_user_id_idx" ON "materials"("created_by_user_id");

-- CreateIndex
CREATE INDEX "materials_is_active_upload_status_idx" ON "materials"("is_active", "upload_status");

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_class_session_id_fkey" FOREIGN KEY ("class_session_id") REFERENCES "class_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

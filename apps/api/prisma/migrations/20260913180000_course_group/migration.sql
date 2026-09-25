-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "courses_is_active_idx" ON "courses"("is_active");

-- CreateIndex
CREATE INDEX "courses_name_idx" ON "courses"("name");

-- CreateTable
CREATE TABLE "groups" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "groups_course_id_idx" ON "groups"("course_id");

-- CreateIndex
CREATE INDEX "groups_is_active_idx" ON "groups"("is_active");

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Catalog permissions for courses and groups CRUD
INSERT INTO "permissions" ("id", "module", "action", "created_at")
VALUES
  (gen_random_uuid(), 'courses', 'read', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'courses', 'create', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'courses', 'update', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'courses', 'delete', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'groups', 'read', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'groups', 'create', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'groups', 'update', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'groups', 'delete', CURRENT_TIMESTAMP);

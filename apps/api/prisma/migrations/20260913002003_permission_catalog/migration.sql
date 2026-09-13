-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "module" VARCHAR(64) NOT NULL,
    "action" VARCHAR(32) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL,
    "role" "user_role" NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "permissions_module_action_key" ON "permissions"("module", "action");

-- CreateIndex
CREATE INDEX "role_permissions_role_idx" ON "role_permissions"("role");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_permission_id_key" ON "role_permissions"("role", "permission_id");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the canonical permission catalog (module, action). No RolePermission
-- grants are inserted here: ADMINISTRATIVE grants are assigned later by Director.
INSERT INTO "permissions" ("id", "module", "action", "created_at") VALUES
  (gen_random_uuid(), 'students', 'read', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'students', 'create', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'students', 'update', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'teachers', 'read', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'teachers', 'create', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'teachers', 'update', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'assignments', 'read', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'assignments', 'create', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'assignments', 'update', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'classes', 'read', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'classes', 'create', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'classes', 'update', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'materials', 'read', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'materials', 'create', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'materials', 'update', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'finance', 'read', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'finance', 'create', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'finance', 'update', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'users', 'read', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'users', 'create', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'users', 'update', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'permissions', 'read', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'permissions', 'update', CURRENT_TIMESTAMP);

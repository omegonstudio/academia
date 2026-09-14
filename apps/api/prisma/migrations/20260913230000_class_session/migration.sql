-- CreateTable
CREATE TABLE "class_sessions" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "start_at" TIMESTAMPTZ(3) NOT NULL,
    "end_at" TIMESTAMPTZ(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "class_sessions_group_id_start_at_idx" ON "class_sessions"("group_id", "start_at");

-- CreateIndex
CREATE INDEX "class_sessions_is_active_idx" ON "class_sessions"("is_active");

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Catalog permission for soft-delete of class sessions
INSERT INTO "permissions" ("id", "module", "action", "created_at")
VALUES (gen_random_uuid(), 'classes', 'delete', CURRENT_TIMESTAMP);

-- DropIndex (replaced by unique)
DROP INDEX IF EXISTS "class_sessions_group_id_start_at_idx";

-- CreateIndex
CREATE UNIQUE INDEX "class_sessions_group_id_start_at_key" ON "class_sessions"("group_id", "start_at");

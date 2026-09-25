-- Calendar range reads filter active sessions by start_at.
CREATE INDEX "class_sessions_is_active_start_at_idx" ON "class_sessions"("is_active", "start_at");

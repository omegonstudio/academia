-- Auto-charge commercial uniqueness (Stage 6C).
-- ONE_TO_ONE: at most one Charge per ClassSession.
-- GROUP_120: at most one Charge per Enrollment + calendar-month period.

CREATE UNIQUE INDEX "charges_class_session_id_key"
  ON "charges" ("class_session_id")
  WHERE "class_session_id" IS NOT NULL;

CREATE UNIQUE INDEX "charges_enrollment_period_key"
  ON "charges" ("enrollment_id", "period_start", "period_end")
  WHERE "enrollment_id" IS NOT NULL;

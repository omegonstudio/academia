-- T3: PaymentSubmission for transfer receipts (independent of Payment ledger).

CREATE TYPE "payment_submission_status" AS ENUM (
  'SUBMITTED',
  'UNDER_REVIEW',
  'NEEDS_CORRECTION',
  'APPROVED',
  'REJECTED'
);

CREATE TABLE "payment_submissions" (
  "id" UUID NOT NULL,
  "charge_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "reported_amount_minor" BIGINT NOT NULL,
  "reported_currency" "finance_currency" NOT NULL,
  "paid_at" TIMESTAMPTZ(3) NOT NULL,
  "receipt_storage_key" VARCHAR(512),
  "receipt_filename" VARCHAR(255),
  "receipt_mime_type" VARCHAR(100),
  "receipt_size_bytes" INTEGER,
  "status" "payment_submission_status" NOT NULL DEFAULT 'SUBMITTED',
  "student_note" VARCHAR(1000),
  "admin_note" VARCHAR(2000),
  "reviewed_by_user_id" UUID,
  "reviewed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payment_submissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_submission_events" (
  "id" UUID NOT NULL,
  "submission_id" UUID NOT NULL,
  "from_status" "payment_submission_status",
  "to_status" "payment_submission_status" NOT NULL,
  "actor_user_id" UUID,
  "note" VARCHAR(2000),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_submission_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_submissions_student_id_status_idx"
  ON "payment_submissions"("student_id", "status");
CREATE INDEX "payment_submissions_charge_id_idx"
  ON "payment_submissions"("charge_id");
CREATE INDEX "payment_submissions_status_created_at_idx"
  ON "payment_submissions"("status", "created_at");
CREATE UNIQUE INDEX "payment_submissions_receipt_storage_key_key"
  ON "payment_submissions"("receipt_storage_key");
CREATE UNIQUE INDEX "payment_submissions_one_approved_per_charge_uidx"
  ON "payment_submissions"("charge_id")
  WHERE "status" = 'APPROVED';

CREATE INDEX "payment_submission_events_submission_id_idx"
  ON "payment_submission_events"("submission_id");

ALTER TABLE "payment_submissions"
  ADD CONSTRAINT "payment_submissions_charge_id_fkey"
  FOREIGN KEY ("charge_id") REFERENCES "charges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_submissions"
  ADD CONSTRAINT "payment_submissions_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_submissions"
  ADD CONSTRAINT "payment_submissions_reviewed_by_user_id_fkey"
  FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_submission_events"
  ADD CONSTRAINT "payment_submission_events_submission_id_fkey"
  FOREIGN KEY ("submission_id") REFERENCES "payment_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_submission_events"
  ADD CONSTRAINT "payment_submission_events_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

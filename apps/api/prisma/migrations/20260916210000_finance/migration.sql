-- Stage 6B-1: Finance foundation (settings, charge, payment, allocation, refund, settlement, webhook).

-- CreateEnum
CREATE TYPE "finance_currency" AS ENUM ('ARS', 'USD');

-- CreateEnum
CREATE TYPE "charge_status" AS ENUM ('OPEN', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "payment_provider" AS ENUM ('MERCADOPAGO', 'STRIPE', 'MANUAL');

-- CreateEnum
CREATE TYPE "revenue_allocation_kind" AS ENUM ('ORIGINAL', 'REVERSAL');

-- CreateEnum
CREATE TYPE "teacher_settlement_status" AS ENUM ('OPEN', 'MARKED_PAID');

-- AlterTable: Course list price (#44)
ALTER TABLE "courses" ADD COLUMN "amount_minor" BIGINT,
ADD COLUMN "currency" "finance_currency";

ALTER TABLE "courses"
  ADD CONSTRAINT "courses_amount_minor_non_negative_check"
  CHECK ("amount_minor" IS NULL OR "amount_minor" >= 0);

ALTER TABLE "courses"
  ADD CONSTRAINT "courses_price_pair_check"
  CHECK (
    ("amount_minor" IS NULL AND "currency" IS NULL)
    OR
    ("amount_minor" IS NOT NULL AND "currency" IS NOT NULL)
  );

-- CreateTable
CREATE TABLE "academy_finance_settings" (
    "id" UUID NOT NULL,
    "academy_percentage" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_user_id" UUID,

    CONSTRAINT "academy_finance_settings_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "academy_finance_settings"
  ADD CONSTRAINT "academy_finance_settings_percentage_check"
  CHECK ("academy_percentage" IN (20, 30, 40, 50));

-- CreateTable
CREATE TABLE "charges" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" "finance_currency" NOT NULL,
    "status" "charge_status" NOT NULL DEFAULT 'OPEN',
    "course_id" UUID,
    "group_id" UUID,
    "enrollment_id" UUID,
    "class_session_id" UUID,
    "description" VARCHAR(500),
    "created_by_user_id" UUID NOT NULL,
    "period_start" DATE,
    "period_end" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charges_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "charges"
  ADD CONSTRAINT "charges_amount_minor_non_negative_check"
  CHECK ("amount_minor" >= 0);

-- Commercial unit XOR: ONE_TO_ONE (class_session) vs GROUP (enrollment + period).
ALTER TABLE "charges"
  ADD CONSTRAINT "charges_commercial_unit_check"
  CHECK (
    (
      "class_session_id" IS NOT NULL
      AND "enrollment_id" IS NULL
      AND "period_start" IS NULL
      AND "period_end" IS NULL
    )
    OR
    (
      "enrollment_id" IS NOT NULL
      AND "period_start" IS NOT NULL
      AND "period_end" IS NOT NULL
      AND "class_session_id" IS NULL
      AND "period_start" < "period_end"
    )
  );

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "charge_id" UUID NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" "finance_currency" NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "provider" "payment_provider" NOT NULL,
    "provider_payment_id" VARCHAR(191),
    "idempotency_key" VARCHAR(191) NOT NULL,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_minor_non_negative_check"
  CHECK ("amount_minor" >= 0);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" "finance_currency" NOT NULL,
    "reason" VARCHAR(500),
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "refunds"
  ADD CONSTRAINT "refunds_amount_minor_non_negative_check"
  CHECK ("amount_minor" >= 0);

-- CreateTable
CREATE TABLE "revenue_allocations" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "charge_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "course_id" UUID,
    "group_id" UUID,
    "kind" "revenue_allocation_kind" NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" "finance_currency" NOT NULL,
    "academy_percentage" INTEGER NOT NULL,
    "academy_amount_minor" BIGINT NOT NULL,
    "teacher_amount_minor" BIGINT NOT NULL,
    "refund_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revenue_allocations_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "revenue_allocations"
  ADD CONSTRAINT "revenue_allocations_percentage_check"
  CHECK ("academy_percentage" IN (20, 30, 40, 50));

ALTER TABLE "revenue_allocations"
  ADD CONSTRAINT "revenue_allocations_split_sum_check"
  CHECK ("academy_amount_minor" + "teacher_amount_minor" = "amount_minor");

ALTER TABLE "revenue_allocations"
  ADD CONSTRAINT "revenue_allocations_reversal_refund_check"
  CHECK (
    ("kind" = 'ORIGINAL' AND "refund_id" IS NULL AND "amount_minor" >= 0)
    OR
    ("kind" = 'REVERSAL' AND "refund_id" IS NOT NULL AND "amount_minor" <= 0)
  );

-- CreateTable
CREATE TABLE "teacher_settlements" (
    "id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "total_teacher_amount_minor" BIGINT NOT NULL,
    "currency" "finance_currency" NOT NULL,
    "status" "teacher_settlement_status" NOT NULL DEFAULT 'OPEN',
    "marked_paid_at" TIMESTAMPTZ(3),
    "note" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_settlements_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "teacher_settlements"
  ADD CONSTRAINT "teacher_settlements_period_check"
  CHECK ("period_start" < "period_end");

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL,
    "provider" "payment_provider" NOT NULL,
    "provider_event_id" VARCHAR(191) NOT NULL,
    "payload" JSONB NOT NULL,
    "processed_at" TIMESTAMPTZ(3),
    "error" VARCHAR(2000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- Indexes / uniques
CREATE UNIQUE INDEX "payments_charge_id_key" ON "payments"("charge_id");
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");
CREATE UNIQUE INDEX "payments_provider_provider_payment_id_key"
  ON "payments"("provider", "provider_payment_id")
  WHERE "provider_payment_id" IS NOT NULL;

CREATE UNIQUE INDEX "refunds_payment_id_key" ON "refunds"("payment_id");

CREATE UNIQUE INDEX "revenue_allocations_payment_id_kind_key"
  ON "revenue_allocations"("payment_id", "kind");
CREATE UNIQUE INDEX "revenue_allocations_refund_id_key"
  ON "revenue_allocations"("refund_id");

CREATE UNIQUE INDEX "teacher_settlements_teacher_id_period_start_period_end_currency_key"
  ON "teacher_settlements"("teacher_id", "period_start", "period_end", "currency");

CREATE UNIQUE INDEX "webhook_events_provider_provider_event_id_key"
  ON "webhook_events"("provider", "provider_event_id");

CREATE INDEX "charges_student_id_status_idx" ON "charges"("student_id", "status");
CREATE INDEX "charges_course_id_idx" ON "charges"("course_id");
CREATE INDEX "charges_group_id_idx" ON "charges"("group_id");
CREATE INDEX "charges_enrollment_id_idx" ON "charges"("enrollment_id");
CREATE INDEX "charges_class_session_id_idx" ON "charges"("class_session_id");
CREATE INDEX "charges_status_idx" ON "charges"("status");

CREATE INDEX "payments_student_id_status_idx" ON "payments"("student_id", "status");
CREATE INDEX "payments_status_idx" ON "payments"("status");
CREATE INDEX "payments_provider_idx" ON "payments"("provider");

CREATE INDEX "revenue_allocations_teacher_id_created_at_idx"
  ON "revenue_allocations"("teacher_id", "created_at");
CREATE INDEX "revenue_allocations_student_id_idx" ON "revenue_allocations"("student_id");
CREATE INDEX "revenue_allocations_charge_id_idx" ON "revenue_allocations"("charge_id");
CREATE INDEX "revenue_allocations_kind_idx" ON "revenue_allocations"("kind");

CREATE INDEX "teacher_settlements_teacher_id_status_idx"
  ON "teacher_settlements"("teacher_id", "status");
CREATE INDEX "teacher_settlements_status_idx" ON "teacher_settlements"("status");

CREATE INDEX "webhook_events_created_at_idx" ON "webhook_events"("created_at");

-- Foreign keys
ALTER TABLE "academy_finance_settings"
  ADD CONSTRAINT "academy_finance_settings_updated_by_user_id_fkey"
  FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "charges"
  ADD CONSTRAINT "charges_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "charges"
  ADD CONSTRAINT "charges_course_id_fkey"
  FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "charges"
  ADD CONSTRAINT "charges_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "charges"
  ADD CONSTRAINT "charges_enrollment_id_fkey"
  FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "charges"
  ADD CONSTRAINT "charges_class_session_id_fkey"
  FOREIGN KEY ("class_session_id") REFERENCES "class_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "charges"
  ADD CONSTRAINT "charges_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_charge_id_fkey"
  FOREIGN KEY ("charge_id") REFERENCES "charges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "refunds"
  ADD CONSTRAINT "refunds_payment_id_fkey"
  FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "revenue_allocations"
  ADD CONSTRAINT "revenue_allocations_payment_id_fkey"
  FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "revenue_allocations"
  ADD CONSTRAINT "revenue_allocations_charge_id_fkey"
  FOREIGN KEY ("charge_id") REFERENCES "charges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "revenue_allocations"
  ADD CONSTRAINT "revenue_allocations_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "revenue_allocations"
  ADD CONSTRAINT "revenue_allocations_teacher_id_fkey"
  FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "revenue_allocations"
  ADD CONSTRAINT "revenue_allocations_course_id_fkey"
  FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "revenue_allocations"
  ADD CONSTRAINT "revenue_allocations_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "revenue_allocations"
  ADD CONSTRAINT "revenue_allocations_refund_id_fkey"
  FOREIGN KEY ("refund_id") REFERENCES "refunds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "teacher_settlements"
  ADD CONSTRAINT "teacher_settlements_teacher_id_fkey"
  FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

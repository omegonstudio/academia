-- Online courses (async LMS) — separate from live Course → Group → ClassSession.

-- Enums
CREATE TYPE "online_course_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "online_course_access_mode" AS ENUM ('OPEN', 'LINEAR');
CREATE TYPE "online_lesson_status" AS ENUM ('DRAFT', 'PUBLISHED');
CREATE TYPE "online_lesson_asset_kind" AS ENUM ('VIDEO', 'DOCUMENT', 'TEXT', 'LINK');
CREATE TYPE "online_lesson_progress_status" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE "online_quiz_question_type" AS ENUM ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_TEXT');
CREATE TYPE "online_submission_status" AS ENUM ('SUBMITTED', 'REVIEWED');

-- online_courses
CREATE TABLE "online_courses" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "subtitle" VARCHAR(300),
    "description" VARCHAR(10000),
    "author_teacher_id" UUID,
    "cover_image_url" VARCHAR(2048),
    "benefits" JSONB,
    "bonus" JSONB,
    "status" "online_course_status" NOT NULL DEFAULT 'DRAFT',
    "access_mode" "online_course_access_mode" NOT NULL DEFAULT 'OPEN',
    "certificate_enabled" BOOLEAN NOT NULL DEFAULT false,
    "amount_minor" BIGINT,
    "currency" "finance_currency",
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "online_courses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "online_courses_slug_key" ON "online_courses"("slug");
CREATE INDEX "online_courses_status_is_active_idx" ON "online_courses"("status", "is_active");
CREATE INDEX "online_courses_author_teacher_id_idx" ON "online_courses"("author_teacher_id");

ALTER TABLE "online_courses"
  ADD CONSTRAINT "online_courses_author_teacher_id_fkey"
  FOREIGN KEY ("author_teacher_id") REFERENCES "teachers"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- online_course_modules
CREATE TABLE "online_course_modules" (
    "id" UUID NOT NULL,
    "online_course_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(2000),
    "position" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "online_course_modules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "online_course_modules_online_course_id_position_idx"
  ON "online_course_modules"("online_course_id", "position");
CREATE INDEX "online_course_modules_online_course_id_is_active_idx"
  ON "online_course_modules"("online_course_id", "is_active");

ALTER TABLE "online_course_modules"
  ADD CONSTRAINT "online_course_modules_online_course_id_fkey"
  FOREIGN KEY ("online_course_id") REFERENCES "online_courses"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- online_lessons
CREATE TABLE "online_lessons" (
    "id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(2000),
    "position" INTEGER NOT NULL,
    "estimated_minutes" INTEGER,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "status" "online_lesson_status" NOT NULL DEFAULT 'DRAFT',
    "accepts_submission" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "online_lessons_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "online_lessons_module_id_position_idx" ON "online_lessons"("module_id", "position");
CREATE INDEX "online_lessons_module_id_is_active_idx" ON "online_lessons"("module_id", "is_active");

ALTER TABLE "online_lessons"
  ADD CONSTRAINT "online_lessons_module_id_fkey"
  FOREIGN KEY ("module_id") REFERENCES "online_course_modules"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- online_lesson_assets
CREATE TABLE "online_lesson_assets" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "kind" "online_lesson_asset_kind" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "position" INTEGER NOT NULL,
    "body_text" VARCHAR(50000),
    "external_url" VARCHAR(2048),
    "upload_status" "material_upload_status",
    "mime_type" VARCHAR(100),
    "size_bytes" INTEGER,
    "storage_key" VARCHAR(512),
    "original_filename" VARCHAR(255),
    "created_by_user_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "online_lesson_assets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "online_lesson_assets_storage_key_key" ON "online_lesson_assets"("storage_key");
CREATE INDEX "online_lesson_assets_lesson_id_position_idx" ON "online_lesson_assets"("lesson_id", "position");
CREATE INDEX "online_lesson_assets_lesson_id_is_active_idx" ON "online_lesson_assets"("lesson_id", "is_active");

ALTER TABLE "online_lesson_assets"
  ADD CONSTRAINT "online_lesson_assets_lesson_id_fkey"
  FOREIGN KEY ("lesson_id") REFERENCES "online_lessons"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "online_lesson_assets"
  ADD CONSTRAINT "online_lesson_assets_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- online_course_accesses
CREATE TABLE "online_course_accesses" (
    "id" UUID NOT NULL,
    "online_course_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3),
    "granted_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "online_course_accesses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "online_course_accesses_online_course_id_student_id_key"
  ON "online_course_accesses"("online_course_id", "student_id");
CREATE INDEX "online_course_accesses_student_id_is_active_idx"
  ON "online_course_accesses"("student_id", "is_active");
CREATE INDEX "online_course_accesses_online_course_id_is_active_idx"
  ON "online_course_accesses"("online_course_id", "is_active");

ALTER TABLE "online_course_accesses"
  ADD CONSTRAINT "online_course_accesses_online_course_id_fkey"
  FOREIGN KEY ("online_course_id") REFERENCES "online_courses"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "online_course_accesses"
  ADD CONSTRAINT "online_course_accesses_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "online_course_accesses"
  ADD CONSTRAINT "online_course_accesses_granted_by_user_id_fkey"
  FOREIGN KEY ("granted_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- online_lesson_progress
CREATE TABLE "online_lesson_progress" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "status" "online_lesson_progress_status" NOT NULL DEFAULT 'NOT_STARTED',
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "score_percent" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "online_lesson_progress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "online_lesson_progress_lesson_id_student_id_key"
  ON "online_lesson_progress"("lesson_id", "student_id");
CREATE INDEX "online_lesson_progress_student_id_status_idx"
  ON "online_lesson_progress"("student_id", "status");

ALTER TABLE "online_lesson_progress"
  ADD CONSTRAINT "online_lesson_progress_lesson_id_fkey"
  FOREIGN KEY ("lesson_id") REFERENCES "online_lessons"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "online_lesson_progress"
  ADD CONSTRAINT "online_lesson_progress_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- online_quizzes
CREATE TABLE "online_quizzes" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "pass_score_percent" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "online_quizzes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "online_quizzes_lesson_id_key" ON "online_quizzes"("lesson_id");

ALTER TABLE "online_quizzes"
  ADD CONSTRAINT "online_quizzes_lesson_id_fkey"
  FOREIGN KEY ("lesson_id") REFERENCES "online_lessons"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- online_quiz_questions
CREATE TABLE "online_quiz_questions" (
    "id" UUID NOT NULL,
    "quiz_id" UUID NOT NULL,
    "prompt" VARCHAR(2000) NOT NULL,
    "type" "online_quiz_question_type" NOT NULL,
    "position" INTEGER NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 1,
    "correct_text" VARCHAR(500),
    "explanation" VARCHAR(2000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "online_quiz_questions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "online_quiz_questions_quiz_id_position_idx"
  ON "online_quiz_questions"("quiz_id", "position");

ALTER TABLE "online_quiz_questions"
  ADD CONSTRAINT "online_quiz_questions_quiz_id_fkey"
  FOREIGN KEY ("quiz_id") REFERENCES "online_quizzes"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- online_quiz_options
CREATE TABLE "online_quiz_options" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "label" VARCHAR(1000) NOT NULL,
    "position" INTEGER NOT NULL,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "online_quiz_options_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "online_quiz_options_question_id_position_idx"
  ON "online_quiz_options"("question_id", "position");

ALTER TABLE "online_quiz_options"
  ADD CONSTRAINT "online_quiz_options_question_id_fkey"
  FOREIGN KEY ("question_id") REFERENCES "online_quiz_questions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- online_quiz_attempts
CREATE TABLE "online_quiz_attempts" (
    "id" UUID NOT NULL,
    "quiz_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "score_percent" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "answers_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "online_quiz_attempts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "online_quiz_attempts_quiz_id_student_id_created_at_idx"
  ON "online_quiz_attempts"("quiz_id", "student_id", "created_at");
CREATE INDEX "online_quiz_attempts_student_id_idx" ON "online_quiz_attempts"("student_id");

ALTER TABLE "online_quiz_attempts"
  ADD CONSTRAINT "online_quiz_attempts_quiz_id_fkey"
  FOREIGN KEY ("quiz_id") REFERENCES "online_quizzes"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "online_quiz_attempts"
  ADD CONSTRAINT "online_quiz_attempts_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- online_lesson_submissions
CREATE TABLE "online_lesson_submissions" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "body_text" VARCHAR(10000),
    "status" "online_submission_status" NOT NULL DEFAULT 'SUBMITTED',
    "feedback" VARCHAR(2000),
    "upload_status" "material_upload_status",
    "mime_type" VARCHAR(100),
    "size_bytes" INTEGER,
    "storage_key" VARCHAR(512),
    "original_filename" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "online_lesson_submissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "online_lesson_submissions_storage_key_key"
  ON "online_lesson_submissions"("storage_key");
CREATE INDEX "online_lesson_submissions_lesson_id_student_id_idx"
  ON "online_lesson_submissions"("lesson_id", "student_id");
CREATE INDEX "online_lesson_submissions_student_id_idx"
  ON "online_lesson_submissions"("student_id");

ALTER TABLE "online_lesson_submissions"
  ADD CONSTRAINT "online_lesson_submissions_lesson_id_fkey"
  FOREIGN KEY ("lesson_id") REFERENCES "online_lessons"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "online_lesson_submissions"
  ADD CONSTRAINT "online_lesson_submissions_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Extend charges for online course products (nullable FKs; live billing unchanged)
ALTER TABLE "charges" ADD COLUMN "online_course_id" UUID;
ALTER TABLE "charges" ADD COLUMN "online_course_access_id" UUID;

CREATE INDEX "charges_online_course_id_idx" ON "charges"("online_course_id");
CREATE INDEX "charges_online_course_access_id_idx" ON "charges"("online_course_access_id");

ALTER TABLE "charges"
  ADD CONSTRAINT "charges_online_course_id_fkey"
  FOREIGN KEY ("online_course_id") REFERENCES "online_courses"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "charges"
  ADD CONSTRAINT "charges_online_course_access_id_fkey"
  FOREIGN KEY ("online_course_access_id") REFERENCES "online_course_accesses"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- One OPEN/PAID charge per student+online course (exclude cancelled)
CREATE UNIQUE INDEX "charges_online_course_student_active_uidx"
  ON "charges" ("online_course_id", "student_id")
  WHERE "online_course_id" IS NOT NULL AND "status" IN ('OPEN', 'PAID');

-- Permission catalog for online courses admin
INSERT INTO "permissions" ("id", "module", "action", "created_at")
VALUES
  (gen_random_uuid(), 'online_courses', 'read', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'online_courses', 'create', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'online_courses', 'update', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'online_courses', 'delete', CURRENT_TIMESTAMP);

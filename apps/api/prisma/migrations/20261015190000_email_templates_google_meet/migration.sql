-- Editable email templates for student-facing notifications (Director / SuperAdmin).
CREATE TABLE "notification_email_templates" (
    "id" UUID NOT NULL,
    "type" VARCHAR(64) NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "body" VARCHAR(4000) NOT NULL,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_email_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_email_templates_type_key" ON "notification_email_templates"("type");

ALTER TABLE "notification_email_templates"
  ADD CONSTRAINT "notification_email_templates_updated_by_user_id_fkey"
  FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Defaults (placeholders: {{displayName}}, {{roleLabel}}, {{teacherName}}, {{studentName}}, {{when}}, {{meetingUrl}}, {{loginUrl}})
INSERT INTO "notification_email_templates" ("id", "type", "subject", "body", "updated_at") VALUES
(
  gen_random_uuid(),
  'USER_CREATED',
  'Bienvenido/a a Academia',
  E'Hola {{displayName}},\n\nTu cuenta de {{roleLabel}} fue creada en Academia.\nYa podés iniciar sesión aquí: {{loginUrl}}\n\nEquipo Academia',
  CURRENT_TIMESTAMP
),
(
  gen_random_uuid(),
  'TEACHER_ASSIGNED',
  'Se te asignó un/a docente',
  E'Hola {{studentName}},\n\n{{teacherName}} quedó asignado/a como tu docente.\nIngresá a tu panel: {{loginUrl}}\n\nEquipo Academia',
  CURRENT_TIMESTAMP
),
(
  gen_random_uuid(),
  'CLASS_MEETING_LINK',
  'Tu clase tiene link de Google Meet',
  E'Hola {{displayName}},\n\nTu clase del {{when}} ya tiene enlace de reunión:\n{{meetingUrl}}\n\nTe esperamos.\nEquipo Academia',
  CURRENT_TIMESTAMP
);

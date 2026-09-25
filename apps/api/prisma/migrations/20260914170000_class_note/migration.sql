-- CreateTable
CREATE TABLE "class_notes" (
    "id" UUID NOT NULL,
    "class_session_id" UUID NOT NULL,
    "content" VARCHAR(4000) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "class_notes_class_session_id_created_at_idx" ON "class_notes"("class_session_id", "created_at");

-- AddForeignKey
ALTER TABLE "class_notes" ADD CONSTRAINT "class_notes_class_session_id_fkey" FOREIGN KEY ("class_session_id") REFERENCES "class_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

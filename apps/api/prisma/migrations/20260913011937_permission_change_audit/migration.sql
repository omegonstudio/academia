-- CreateEnum
CREATE TYPE "permission_change_type" AS ENUM ('GRANT', 'REVOKE');

-- CreateTable
CREATE TABLE "permission_change_audits" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "target_role" "user_role" NOT NULL,
    "change_type" "permission_change_type" NOT NULL,
    "module" VARCHAR(64) NOT NULL,
    "action" VARCHAR(32) NOT NULL,
    "outcome" VARCHAR(32) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_change_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "permission_change_audits_created_at_idx" ON "permission_change_audits"("created_at");

-- CreateIndex
CREATE INDEX "permission_change_audits_actor_user_id_idx" ON "permission_change_audits"("actor_user_id");

-- CreateIndex
CREATE INDEX "permission_change_audits_target_role_created_at_idx" ON "permission_change_audits"("target_role", "created_at");

-- AddForeignKey
ALTER TABLE "permission_change_audits" ADD CONSTRAINT "permission_change_audits_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

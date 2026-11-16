-- T2: allow multiple Payment rows per Charge for FAILED/CANCELLED history,
-- while keeping at most one live attempt (PENDING or SUCCEEDED).
-- Partials remain forbidden in domain (full amount only; see DECISIONS #53).

DROP INDEX IF EXISTS "payments_charge_id_key";

CREATE INDEX "payments_charge_id_idx" ON "payments"("charge_id");

CREATE UNIQUE INDEX "payments_one_live_per_charge_uidx"
  ON "payments"("charge_id")
  WHERE "status" IN ('PENDING', 'SUCCEEDED');

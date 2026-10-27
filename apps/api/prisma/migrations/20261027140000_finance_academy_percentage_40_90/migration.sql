-- Expand writable academy split to 40–90 (retire 20|30 for new settings).
-- Frozen RevenueAllocation rows may keep legacy 20|30 forever.

UPDATE "academy_finance_settings"
SET "academy_percentage" = 40
WHERE "academy_percentage" IN (20, 30);

ALTER TABLE "academy_finance_settings"
  DROP CONSTRAINT "academy_finance_settings_percentage_check";

ALTER TABLE "academy_finance_settings"
  ADD CONSTRAINT "academy_finance_settings_percentage_check"
  CHECK ("academy_percentage" IN (40, 50, 60, 70, 80, 90));

ALTER TABLE "revenue_allocations"
  DROP CONSTRAINT "revenue_allocations_percentage_check";

ALTER TABLE "revenue_allocations"
  ADD CONSTRAINT "revenue_allocations_percentage_check"
  CHECK ("academy_percentage" IN (20, 30, 40, 50, 60, 70, 80, 90));

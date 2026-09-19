-- Carry-over is now controlled by the global User.carryOverEnabled setting,
-- so the per-budget toggle column is no longer used. The optional per-budget
-- rolloverCap is kept.
ALTER TABLE "Budget" DROP COLUMN "rolloverEnabled";

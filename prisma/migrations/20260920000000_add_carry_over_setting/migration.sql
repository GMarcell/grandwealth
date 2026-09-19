-- Global carry-over setting: keep unused budget rolling into the next month.
-- Purely a budget concept; it does not create transactions or income.
ALTER TABLE "User" ADD COLUMN "carryOverEnabled" BOOLEAN NOT NULL DEFAULT true;

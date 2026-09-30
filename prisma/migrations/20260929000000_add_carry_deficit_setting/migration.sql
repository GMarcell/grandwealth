-- Optional switch for the overall monthly balance carry-over: when false, a
-- month's deficit (expenses > income) no longer carries as a negative balance
-- into the next month — only surpluses do. Defaults to true, which is the
-- previous always-carry behavior.
ALTER TABLE "User" ADD COLUMN "carryDeficitEnabled" BOOLEAN NOT NULL DEFAULT true;

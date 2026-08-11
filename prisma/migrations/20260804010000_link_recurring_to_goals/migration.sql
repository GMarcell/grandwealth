-- AlterTable
ALTER TABLE "RecurringTransaction" ADD COLUMN "savingsGoalId" TEXT;

-- CreateIndex
CREATE INDEX "RecurringTransaction_savingsGoalId_idx" ON "RecurringTransaction"("savingsGoalId");

-- AddForeignKey
ALTER TABLE "RecurringTransaction" ADD CONSTRAINT "RecurringTransaction_savingsGoalId_fkey" FOREIGN KEY ("savingsGoalId") REFERENCES "SavingsGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

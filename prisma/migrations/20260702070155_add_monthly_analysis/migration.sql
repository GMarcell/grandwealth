-- CreateTable
CREATE TABLE "MonthlyAnalysis" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "totalIncome" DOUBLE PRECISION NOT NULL,
    "totalExpenses" DOUBLE PRECISION NOT NULL,
    "netSavings" DOUBLE PRECISION NOT NULL,
    "savingsRate" DOUBLE PRECISION NOT NULL,
    "topCategory" TEXT,
    "topCategoryAmount" DOUBLE PRECISION,
    "stockValue" DOUBLE PRECISION,
    "goldValue" DOUBLE PRECISION,
    "budgetCount" INTEGER NOT NULL DEFAULT 0,
    "overBudgetCount" INTEGER NOT NULL DEFAULT 0,
    "transactionCount" INTEGER NOT NULL DEFAULT 0,
    "rawData" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyAnalysis_month_userId_key" ON "MonthlyAnalysis"("month", "userId");

-- AddForeignKey
ALTER TABLE "MonthlyAnalysis" ADD CONSTRAINT "MonthlyAnalysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

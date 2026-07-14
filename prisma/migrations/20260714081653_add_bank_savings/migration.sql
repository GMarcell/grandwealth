-- CreateEnum
CREATE TYPE "SavingType" AS ENUM ('DEPOSIT', 'WITHDRAWAL');

-- CreateTable
CREATE TABLE "BankSaving" (
    "id" TEXT NOT NULL,
    "type" "SavingType" NOT NULL,
    "accountName" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankSaving_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BankSaving" ADD CONSTRAINT "BankSaving_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

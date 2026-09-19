-- CreateEnum
CREATE TYPE "TrialRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

-- CreateTable
CREATE TABLE "TrialRequest" (
    "id" TEXT NOT NULL,
    "status" "TrialRequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "decisionNote" TEXT,
    "userId" TEXT NOT NULL,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrialRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrialRequest_status_createdAt_idx" ON "TrialRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TrialRequest_userId_idx" ON "TrialRequest"("userId");

-- AddForeignKey
ALTER TABLE "TrialRequest" ADD CONSTRAINT "TrialRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

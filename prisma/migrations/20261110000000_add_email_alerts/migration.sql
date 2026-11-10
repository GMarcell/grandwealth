-- AlterTable
ALTER TABLE "User" ADD COLUMN     "alertsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "billReminderDays" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "budgetAlertThreshold" INTEGER NOT NULL DEFAULT 80;

-- CreateTable
CREATE TABLE "AlertSend" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertSend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AlertSend_userId_key_key" ON "AlertSend"("userId", "key");

-- CreateIndex
CREATE INDEX "AlertSend_userId_sentAt_idx" ON "AlertSend"("userId", "sentAt");

-- AddForeignKey
ALTER TABLE "AlertSend" ADD CONSTRAINT "AlertSend_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Stock" ADD COLUMN     "currentPrice" DOUBLE PRECISION,
ADD COLUMN     "lastPriceUpdated" TIMESTAMP(3);

-- CreateEnum
CREATE TYPE "RuleType" AS ENUM ('NEED', 'WANT', 'SAVINGS');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "ruleType" "RuleType";

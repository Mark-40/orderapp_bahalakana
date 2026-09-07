-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('ADVANCE', 'SNACK_4PM', 'BREAKFAST');

-- AlterTable
ALTER TABLE "orders"
  ADD COLUMN "orderType" "OrderType" NOT NULL DEFAULT 'ADVANCE';

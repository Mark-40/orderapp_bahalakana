-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'GCASH');

-- AlterTable: Order
ALTER TABLE "orders"
  ADD COLUMN "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
  ADD COLUMN "paymentReceiptUrl" TEXT,
  ALTER COLUMN "customerPhone" DROP NOT NULL,
  ALTER COLUMN "fulfillment" SET DEFAULT 'DELIVERY';

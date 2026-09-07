-- AlterTable
ALTER TABLE "orders"
  ADD COLUMN "isAdvance" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "scheduledFor" TIMESTAMP(3);

-- Backfill. Timestamps are stored as naive UTC, so each conversion is spelled
-- out: read the value as UTC, re-read it as Manila wall clock, and convert the
-- resulting Manila midnight back to naive UTC for storage.

-- An ADVANCE order is advance by definition, and its service date was only
-- ever recorded in the customer's notes, so scheduledFor stays NULL.
UPDATE "orders" SET "isAdvance" = true WHERE "orderType" = 'ADVANCE';

-- Every other historical order was served on the Philippine calendar day it
-- was placed.
UPDATE "orders"
SET "scheduledFor" = (
  date_trunc('day', ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila')
    AT TIME ZONE 'Asia/Manila'
) AT TIME ZONE 'UTC'
WHERE "orderType" <> 'ADVANCE';

-- ...except a breakfast ordered at or after the 4PM cutoff, which under the
-- new rule belongs to the following morning.
UPDATE "orders"
SET "isAdvance" = true,
    "scheduledFor" = "scheduledFor" + INTERVAL '1 day'
WHERE "orderType" = 'BREAKFAST'
  AND EXTRACT(HOUR FROM (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila')) >= 16;

-- CreateIndex
CREATE INDEX "orders_isAdvance_scheduledFor_idx" ON "orders"("isAdvance", "scheduledFor");

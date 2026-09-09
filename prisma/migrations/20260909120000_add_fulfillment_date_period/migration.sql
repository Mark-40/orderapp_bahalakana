-- Explicit fulfillment date + period replace the older orderType / isAdvance /
-- scheduledFor triplet. The old model let an ADVANCE order carry its wanted
-- date only inside `notes`, so the admin's "today" view lost orders placed on
-- an earlier day for today's service. Now every order stores the exact
-- Philippine-midnight instant it is prepared for.

-- 1. Create the new enum.
CREATE TYPE "FulfillmentPeriod" AS ENUM ('BREAKFAST', 'SNACK');

-- 2. Add the new columns as nullable so backfill can run in place.
ALTER TABLE "orders"
  ADD COLUMN "fulfillmentDate" TIMESTAMP(3),
  ADD COLUMN "fulfillmentPeriod" "FulfillmentPeriod";

-- 3. Backfill fulfillmentPeriod from orderType. Legacy ADVANCE orders had no
-- explicit period; snack is the safe default and these orders have already
-- been served, so the value is only there to keep the column NOT NULL.
UPDATE "orders" SET "fulfillmentPeriod" = 'BREAKFAST' WHERE "orderType" = 'BREAKFAST';
UPDATE "orders" SET "fulfillmentPeriod" = 'SNACK'     WHERE "orderType" IN ('SNACK_4PM', 'ADVANCE');

-- 4. Backfill fulfillmentDate. Use scheduledFor when it exists; otherwise fall
-- back to the Philippine-calendar day the order was placed on.
UPDATE "orders"
SET "fulfillmentDate" = COALESCE(
  "scheduledFor",
  (
    date_trunc('day', ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila')
    AT TIME ZONE 'Asia/Manila'
  ) AT TIME ZONE 'UTC'
);

-- 5. Lock the columns in as NOT NULL now that every row has a value.
ALTER TABLE "orders"
  ALTER COLUMN "fulfillmentDate" SET NOT NULL,
  ALTER COLUMN "fulfillmentPeriod" SET NOT NULL;

-- 6. Swap the index.
DROP INDEX "orders_isAdvance_scheduledFor_idx";
CREATE INDEX "orders_fulfillmentDate_fulfillmentPeriod_idx"
  ON "orders" ("fulfillmentDate", "fulfillmentPeriod");

-- 7. Retire the old columns and the OrderType enum.
ALTER TABLE "orders"
  DROP COLUMN "orderType",
  DROP COLUMN "isAdvance",
  DROP COLUMN "scheduledFor";

DROP TYPE "OrderType";

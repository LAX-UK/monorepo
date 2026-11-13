-- Rollback for 0380_lot_premium_uses_sale. Roll back the release first, then this.
--
-- The old schema needs a rate on every lot. First, every lot the migration cleared gets back the
-- exact rate it held (kept in drizzle.lot_premium_rate_before_0380), unless staff have since
-- given it a rate of its own. Then the remaining NULLs, lots written by the new release without
-- their own premium, get their sale's flat rate, or 15% for a lot outside a sale: the old code
-- charges the rate it reads, and that is the premium the new release charged them (for a sale
-- with bands the old code reads the bands, not the lot). Lots that already hold a rate are not
-- touched. Restores the 25% defaults, drops the kept rates and removes this migration's ledger
-- row so a later deploy reapplies it.
BEGIN;

SET LOCAL lock_timeout = '5s';
UPDATE "lot" AS l
  SET "buyer_premium_rate" = b."buyer_premium_rate"
  FROM "drizzle"."lot_premium_rate_before_0380" AS b
  WHERE b."lot_id" = l."id" AND l."buyer_premium_rate" IS NULL;
UPDATE "lot" AS l
  SET "buyer_premium_rate" = COALESCE(
    (SELECT s."buyer_premium_rate" FROM "sale" AS s WHERE s."id" = l."sale_id"),
    0.15
  )
  WHERE l."buyer_premium_rate" IS NULL;
ALTER TABLE "lot" ALTER COLUMN "buyer_premium_rate" SET NOT NULL;
ALTER TABLE "lot" ALTER COLUMN "buyer_premium_rate" SET DEFAULT 0.25;
COMMENT ON COLUMN "lot"."buyer_premium_rate" IS NULL;
ALTER TABLE "sale" ALTER COLUMN "buyer_premium_rate" SET DEFAULT 0.25;
COMMENT ON COLUMN "sale"."buyer_premium_tiers" IS
  'Optional band-based tier override. JSONB array of {hammerThresholdMinor, rate} sorted ascending by threshold. NULL = no override (use lot.buyer_premium_rate).';
DROP TABLE "drizzle"."lot_premium_rate_before_0380";

DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1810987200000;

COMMIT;

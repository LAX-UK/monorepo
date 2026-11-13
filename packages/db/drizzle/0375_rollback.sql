-- Rollback for 0375_lot_premium_uses_sale. Roll back the release first, then this.
--
-- The old schema needs a rate on every lot. Lots that use their sale's premium (NULL, only ever
-- written by the new release) are given the rate the old code would read for them: their sale's
-- flat rate, or 15% for a lot outside a sale. Lots that already hold a rate are not touched.
-- Restores the 25% defaults and removes this migration's ledger row so a later deploy reapplies it.
BEGIN;

SET LOCAL lock_timeout = '5s';
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

DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1810555200000;

COMMIT;

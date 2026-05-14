ALTER TABLE "sale" DROP CONSTRAINT IF EXISTS "sale_buyer_premium_tiers_shape";
ALTER TABLE "sale" DROP COLUMN IF EXISTS "buyer_premium_tiers";

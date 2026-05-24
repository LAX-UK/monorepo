ALTER TABLE "bid" DROP COLUMN IF EXISTS "auto_bid_step_amount";
ALTER TABLE "lot" DROP COLUMN IF EXISTS "auto_bid_step_presets";
ALTER TABLE "lot" DROP COLUMN IF EXISTS "auto_bid_step_max";
ALTER TABLE "lot" DROP COLUMN IF EXISTS "auto_bid_step_min";
ALTER TABLE "lot" DROP COLUMN IF EXISTS "auto_bid_enabled";

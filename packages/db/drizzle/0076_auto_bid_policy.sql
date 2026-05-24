ALTER TABLE "lot" ADD COLUMN IF NOT EXISTS "auto_bid_enabled" boolean NOT NULL DEFAULT true;
ALTER TABLE "lot" ADD COLUMN IF NOT EXISTS "auto_bid_step_min" numeric(18, 2);
ALTER TABLE "lot" ADD COLUMN IF NOT EXISTS "auto_bid_step_max" numeric(18, 2);
ALTER TABLE "lot" ADD COLUMN IF NOT EXISTS "auto_bid_step_presets" jsonb;
ALTER TABLE "bid" ADD COLUMN IF NOT EXISTS "auto_bid_step_amount" numeric(18, 2);

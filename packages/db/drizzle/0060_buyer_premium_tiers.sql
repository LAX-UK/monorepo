-- Tiered buyer premium configuration on `sale` (nullable).
-- Shape: jsonb array of { "hammerThresholdMinor": int >= 0, "rate": "0.0000"..."1.0000" } sorted ascending by threshold.
-- Semantics: band-based (rate that applies to the whole hammer). See docs/runbooks/buyer-premium-tiers.md.
-- NULL means "no tier override" → callers fall back to lot.buyer_premium_rate (existing behaviour).
ALTER TABLE "sale" ADD COLUMN IF NOT EXISTS "buyer_premium_tiers" jsonb;
--> statement-breakpoint
COMMENT ON COLUMN "sale"."buyer_premium_tiers" IS
  'Optional band-based tier override. JSONB array of {hammerThresholdMinor, rate} sorted ascending by threshold. NULL = no override (use lot.buyer_premium_rate).';
--> statement-breakpoint
-- Guard: when present, must be a non-empty JSON array.
ALTER TABLE "sale" DROP CONSTRAINT IF EXISTS "sale_buyer_premium_tiers_shape";
--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_buyer_premium_tiers_shape"
  CHECK (
    "buyer_premium_tiers" IS NULL
    OR (
      jsonb_typeof("buyer_premium_tiers") = 'array'
      AND jsonb_array_length("buyer_premium_tiers") >= 1
    )
  );

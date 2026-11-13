-- A lot's buyer's premium comes from its sale unless staff set one on the lot.
--
-- `lot.buyer_premium_rate` becomes the lot's own premium (an override): NULL means "use the
-- sale's premium" (its bands, else its flat rate). It loses its 25% default, so a lot created
-- without a rate no longer silently charges 25%.
--
-- One set of rows changes: lots in a sale with bands that have no live invoice. The old code
-- never read their rate (a sale's bands always won), so clearing it keeps them on the bands they
-- were already priced on. Without this, the stored rate (usually the old 25% default) would
-- become an override and reprice active lots mid-bidding and sold lots whose invoice is not yet
-- raised. Invoiced lots keep their rate untouched (every surface reads their invoice), and lots
-- in flat-rate sales keep theirs, because the old code charged it.
--
-- `sale.buyer_premium_rate` (the flat rate, used only when a sale has no bands) defaults to 15%,
-- the standard's first band, instead of 25%. The application gives every new sale the standard
-- bands (15% up to £500,000, 10% above), so the default only reaches rows written outside it.
-- Existing sales keep their rates and bands.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "lot" ALTER COLUMN "buyer_premium_rate" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "lot" ALTER COLUMN "buyer_premium_rate" DROP NOT NULL;
--> statement-breakpoint
UPDATE "lot" AS l
  SET "buyer_premium_rate" = NULL
  FROM "sale" AS s
  WHERE s."id" = l."sale_id"
    AND l."buyer_premium_rate" IS NOT NULL
    AND jsonb_typeof(s."buyer_premium_tiers") = 'array'
    AND jsonb_array_length(s."buyer_premium_tiers") > 0
    AND NOT EXISTS (
      SELECT 1 FROM "bid_invoice" AS i WHERE i."lot_id" = l."id" AND i."voided_at" IS NULL
    );
--> statement-breakpoint
COMMENT ON COLUMN "lot"."buyer_premium_rate" IS
  'The lot''s own buyer''s premium, set only when staff override the sale''s. NULL = use the sale''s premium (bands, else flat rate).';
--> statement-breakpoint
ALTER TABLE "sale" ALTER COLUMN "buyer_premium_rate" SET DEFAULT 0.15;
--> statement-breakpoint
COMMENT ON COLUMN "sale"."buyer_premium_tiers" IS
  'The sale''s premium bands, charged slice by slice: JSONB array of {hammerThresholdMinor, rate} ascending from 0. NULL = the sale charges its flat buyer_premium_rate.';

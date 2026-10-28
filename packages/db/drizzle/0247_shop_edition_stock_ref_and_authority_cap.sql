-- Every writer of shop_edition now sets stock_ref itself, so the bridge that copied it from the
-- edition number goes: a print inserted without a stock reference is refused instead of guessed.
-- Sale authority is capped by the prints an owner holds in the run (checked by shop-api), not at
-- a fixed 10, so the two count checks keep only "0 or more".
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
DROP TRIGGER IF EXISTS "shop_edition_default_stock_ref_trg" ON "shop_edition";
--> statement-breakpoint
DROP FUNCTION IF EXISTS "shop_edition_default_stock_ref"();
--> statement-breakpoint
ALTER TABLE "shop_edition" ALTER COLUMN "stock_ref" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "shop_sale_authority_request"
  DROP CONSTRAINT IF EXISTS "shop_sale_authority_request_count_range";
--> statement-breakpoint
ALTER TABLE "shop_sale_authority_request"
  ADD CONSTRAINT "shop_sale_authority_request_count_range" CHECK ("requested_count" >= 0);
--> statement-breakpoint
ALTER TABLE "shop_sale_authority_grant"
  DROP CONSTRAINT IF EXISTS "shop_sale_authority_grant_count_range";
--> statement-breakpoint
ALTER TABLE "shop_sale_authority_grant"
  ADD CONSTRAINT "shop_sale_authority_grant_count_range" CHECK ("authorised_count" >= 0);

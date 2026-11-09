-- Who carries a delivery quote, and why one was turned down. Additive: two nullable columns on the
-- table from 0332, and a rule that a priced quote names its carrier. No quote has been priced yet
-- (nothing could price one before this), so the rule holds for every existing row.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "shop_delivery_quote" ADD COLUMN IF NOT EXISTS "quoted_carrier" text;
--> statement-breakpoint
ALTER TABLE "shop_delivery_quote" ADD COLUMN IF NOT EXISTS "decline_note" text;
--> statement-breakpoint
ALTER TABLE "shop_delivery_quote" ADD CONSTRAINT "shop_delivery_quote_carrier_check" CHECK ("status" NOT IN ('quoted', 'accepted') OR length(btrim("quoted_carrier")) > 0);

ALTER TABLE "shop_order_line" DROP CONSTRAINT IF EXISTS "shop_order_line_price_nonnegative";
--> statement-breakpoint
ALTER TABLE "shop_basket_line" DROP CONSTRAINT IF EXISTS "shop_basket_line_price_nonnegative";
--> statement-breakpoint
ALTER TABLE "shop_basket_line" DROP CONSTRAINT IF EXISTS "shop_basket_line_quantity_positive";
-- irreversible: owner_party_id backfill is not rolled back.

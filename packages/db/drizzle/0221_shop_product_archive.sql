-- Lets staff withdraw a product, or one of its variants, from sale without deleting it: order
-- lines reference both, so the rows must stay. Additive and nullable, so an older shop-api keeps
-- working (it simply keeps selling everything).
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "shop_product" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "shop_product_variant" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;

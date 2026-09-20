ALTER TABLE "shop_order" ADD COLUMN IF NOT EXISTS "delivery_line1" text;
--> statement-breakpoint
ALTER TABLE "shop_order" ADD COLUMN IF NOT EXISTS "delivery_line2" text;
--> statement-breakpoint
ALTER TABLE "shop_order" ADD COLUMN IF NOT EXISTS "delivery_city" text;
--> statement-breakpoint
ALTER TABLE "shop_order" ADD COLUMN IF NOT EXISTS "delivery_postcode" text;
--> statement-breakpoint
ALTER TABLE "shop_order" ADD COLUMN IF NOT EXISTS "delivery_country" text;

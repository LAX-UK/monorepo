CREATE TYPE "shop_sales_channel" AS ENUM('shop', 'art');
--> statement-breakpoint
ALTER TABLE "shop_artwork"
  ADD COLUMN IF NOT EXISTS "sales_channel" "shop_sales_channel" DEFAULT 'shop' NOT NULL;
--> statement-breakpoint
ALTER TABLE "shop_order"
  ADD COLUMN IF NOT EXISTS "sales_channel" "shop_sales_channel" DEFAULT 'shop' NOT NULL;
--> statement-breakpoint
ALTER TABLE "shop_original_sale"
  ADD COLUMN IF NOT EXISTS "sales_channel" "shop_sales_channel" DEFAULT 'art' NOT NULL;

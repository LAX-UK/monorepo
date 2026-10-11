ALTER TABLE "shop_original_sale" DROP COLUMN IF EXISTS "sales_channel";
ALTER TABLE "shop_order" DROP COLUMN IF EXISTS "sales_channel";
ALTER TABLE "shop_artwork" DROP COLUMN IF EXISTS "sales_channel";
DROP TYPE IF EXISTS "shop_sales_channel";

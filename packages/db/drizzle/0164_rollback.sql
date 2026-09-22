DROP TABLE IF EXISTS "shop_home_placement";
--> statement-breakpoint
DROP TABLE IF EXISTS "shop_artwork_category";
--> statement-breakpoint
DROP TABLE IF EXISTS "shop_category";
--> statement-breakpoint
ALTER TABLE "shop_artwork"
  DROP COLUMN IF EXISTS "sale_state",
  DROP COLUMN IF EXISTS "year_created",
  DROP COLUMN IF EXISTS "dimensions";
--> statement-breakpoint
ALTER TABLE "shop_artist"
  DROP COLUMN IF EXISTS "bio",
  DROP COLUMN IF EXISTS "discipline",
  DROP COLUMN IF EXISTS "portrait_image_url";
--> statement-breakpoint
DROP TYPE IF EXISTS "shop_placement_slot";
--> statement-breakpoint
DROP TYPE IF EXISTS "shop_sale_state";

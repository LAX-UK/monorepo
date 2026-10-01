DROP INDEX IF EXISTS "shop_edition_listing_sellable_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "shop_artist_zoho_code_uid";
--> statement-breakpoint
ALTER TABLE "shop_artist" DROP COLUMN IF EXISTS "zoho_artist_code";
--> statement-breakpoint
ALTER TABLE "shop_artwork"
  DROP COLUMN IF EXISTS "version",
  DROP COLUMN IF EXISTS "zoho_product_id",
  DROP COLUMN IF EXISTS "print_frame",
  DROP COLUMN IF EXISTS "print_paper",
  DROP COLUMN IF EXISTS "print_size",
  DROP COLUMN IF EXISTS "print_price_floor_pence";
--> statement-breakpoint
ALTER TABLE "shop_edition"
  DROP COLUMN IF EXISTS "version",
  DROP COLUMN IF EXISTS "withdrawn_reason",
  DROP COLUMN IF EXISTS "sale_authorised_at",
  DROP COLUMN IF EXISTS "custody_status",
  DROP COLUMN IF EXISTS "listing_status";
--> statement-breakpoint
DROP TYPE IF EXISTS "shop_edition_custody_status";
--> statement-breakpoint
DROP TYPE IF EXISTS "shop_edition_listing_status";

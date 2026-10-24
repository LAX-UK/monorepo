-- Lets staff keep an artwork as a draft, publish and unpublish it, and archive it; and archive an
-- artist. Rows are never deleted because editions, orders and sales reference them.
-- `published_at` defaults to now() so imports and seeds keep publishing on insert; staff-created
-- artworks are inserted with null (a draft). Existing rows count as published from creation.
-- Additive and nullable, so an older shop-api keeps working (it shows everything, as before).
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "shop_artwork" ADD COLUMN IF NOT EXISTS "published_at" timestamp with time zone DEFAULT now();
--> statement-breakpoint
UPDATE "shop_artwork" SET "published_at" = "created_at";
--> statement-breakpoint
ALTER TABLE "shop_artwork" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "shop_artist" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;

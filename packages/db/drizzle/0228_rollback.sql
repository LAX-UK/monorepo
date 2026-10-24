ALTER TABLE "shop_artist" DROP COLUMN IF EXISTS "archived_at";

ALTER TABLE "shop_artwork" DROP COLUMN IF EXISTS "archived_at";

ALTER TABLE "shop_artwork" DROP COLUMN IF EXISTS "published_at";

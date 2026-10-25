DROP INDEX IF EXISTS "shop_artwork_source_original_idx";

ALTER TABLE "shop_artwork" DROP CONSTRAINT IF EXISTS "shop_artwork_source_original_not_self";

ALTER TABLE "shop_artwork" DROP CONSTRAINT IF EXISTS "shop_artwork_source_original_artwork_id_shop_artwork_id_fk";

ALTER TABLE "shop_artwork" DROP COLUMN IF EXISTS "source_original_artwork_id";

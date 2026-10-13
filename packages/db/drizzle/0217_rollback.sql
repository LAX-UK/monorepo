ALTER TABLE "shop_editorial_page"
  DROP COLUMN IF EXISTS "seo_description",
  DROP COLUMN IF EXISTS "seo_title";

ALTER TABLE "shop_editorial_story"
  DROP COLUMN IF EXISTS "seo_description",
  DROP COLUMN IF EXISTS "seo_title";

ALTER TABLE "shop_artist"
  DROP COLUMN IF EXISTS "seo_description",
  DROP COLUMN IF EXISTS "seo_title";

ALTER TABLE "shop_artwork"
  DROP COLUMN IF EXISTS "seo_description",
  DROP COLUMN IF EXISTS "seo_title";

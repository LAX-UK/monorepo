ALTER TABLE "shop_artist"
  DROP COLUMN IF EXISTS "short_bio",
  DROP COLUMN IF EXISTS "death_year",
  DROP COLUMN IF EXISTS "birth_year",
  DROP COLUMN IF EXISTS "nationality",
  DROP COLUMN IF EXISTS "hero_media_key";

DROP TABLE IF EXISTS "shop_artwork_image";

ALTER TABLE "shop_artwork"
  DROP COLUMN IF EXISTS "exhibition_history",
  DROP COLUMN IF EXISTS "provenance",
  DROP COLUMN IF EXISTS "has_certificate",
  DROP COLUMN IF EXISTS "depth_cm",
  DROP COLUMN IF EXISTS "width_cm",
  DROP COLUMN IF EXISTS "height_cm",
  DROP COLUMN IF EXISTS "rarity",
  DROP COLUMN IF EXISTS "object_type";

DROP TYPE IF EXISTS "shop_artwork_rarity";
DROP TYPE IF EXISTS "shop_artwork_object_type";

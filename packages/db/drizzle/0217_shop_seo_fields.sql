-- Optional per-record search metadata; storefronts fall back to their templates when null.
ALTER TABLE "shop_artwork"
  ADD COLUMN IF NOT EXISTS "seo_title" text,
  ADD COLUMN IF NOT EXISTS "seo_description" text;

ALTER TABLE "shop_artist"
  ADD COLUMN IF NOT EXISTS "seo_title" text,
  ADD COLUMN IF NOT EXISTS "seo_description" text;

ALTER TABLE "shop_editorial_story"
  ADD COLUMN IF NOT EXISTS "seo_title" text,
  ADD COLUMN IF NOT EXISTS "seo_description" text;

ALTER TABLE "shop_editorial_page"
  ADD COLUMN IF NOT EXISTS "seo_title" text,
  ADD COLUMN IF NOT EXISTS "seo_description" text;

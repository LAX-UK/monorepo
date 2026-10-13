CREATE TYPE "public"."shop_artwork_object_type" AS ENUM(
  'painting',
  'work_on_paper',
  'sculpture',
  'photography',
  'print',
  'mixed_media'
);

CREATE TYPE "public"."shop_artwork_rarity" AS ENUM(
  'unique',
  'limited_edition',
  'open_edition'
);

ALTER TABLE "shop_artwork"
  ADD COLUMN IF NOT EXISTS "object_type" "shop_artwork_object_type",
  ADD COLUMN IF NOT EXISTS "rarity" "shop_artwork_rarity",
  ADD COLUMN IF NOT EXISTS "height_cm" numeric(8, 2),
  ADD COLUMN IF NOT EXISTS "width_cm" numeric(8, 2),
  ADD COLUMN IF NOT EXISTS "depth_cm" numeric(8, 2),
  ADD COLUMN IF NOT EXISTS "has_certificate" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "provenance" text,
  ADD COLUMN IF NOT EXISTS "exhibition_history" text;

CREATE TABLE IF NOT EXISTS "shop_artwork_image" (
  "artwork_id" uuid NOT NULL REFERENCES "shop_artwork"("id") ON DELETE CASCADE,
  "media_key" text NOT NULL,
  "position" integer NOT NULL,
  "alt" text,
  "caption" text,
  CONSTRAINT "shop_artwork_image_pk" PRIMARY KEY ("artwork_id", "position")
);

CREATE UNIQUE INDEX IF NOT EXISTS "shop_artwork_image_artwork_media_uid"
  ON "shop_artwork_image" ("artwork_id", "media_key");

CREATE INDEX IF NOT EXISTS "shop_artwork_image_media_key_idx"
  ON "shop_artwork_image" ("media_key");

ALTER TABLE "shop_artist"
  ADD COLUMN IF NOT EXISTS "hero_media_key" text,
  ADD COLUMN IF NOT EXISTS "nationality" text,
  ADD COLUMN IF NOT EXISTS "birth_year" integer,
  ADD COLUMN IF NOT EXISTS "death_year" integer,
  ADD COLUMN IF NOT EXISTS "short_bio" text;

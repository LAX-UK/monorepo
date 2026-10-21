-- Irreversible: PostgreSQL cannot drop individual enum labels, so 'podcast' stays on
-- shop_editorial_story_kind and the new labels stay on shop_editorial_placement_slot.
ALTER TABLE "shop_editorial_placement"
  DROP COLUMN IF EXISTS "cta_label",
  DROP COLUMN IF EXISTS "body";

ALTER TABLE "shop_editorial_story_artwork" DROP COLUMN IF EXISTS "position";

ALTER TABLE "shop_editorial_story_artist" DROP COLUMN IF EXISTS "position";

ALTER TABLE "shop_editorial_exhibition_artist" DROP COLUMN IF EXISTS "position";

ALTER TABLE "shop_editorial_venue" DROP CONSTRAINT IF EXISTS "shop_editorial_venue_coordinates_chk";

ALTER TABLE "shop_editorial_venue"
  DROP COLUMN IF EXISTS "longitude",
  DROP COLUMN IF EXISTS "latitude",
  DROP COLUMN IF EXISTS "city",
  DROP COLUMN IF EXISTS "street_line";

ALTER TABLE "shop_editorial_exhibition"
  DROP COLUMN IF EXISTS "contact_avatar_media_key",
  DROP COLUMN IF EXISTS "contact_phone",
  DROP COLUMN IF EXISTS "contact_email",
  DROP COLUMN IF EXISTS "contact_role",
  DROP COLUMN IF EXISTS "contact_name",
  DROP COLUMN IF EXISTS "subtitle";

ALTER TABLE "shop_editorial_story" DROP CONSTRAINT IF EXISTS "shop_editorial_story_counts_chk";

ALTER TABLE "shop_editorial_story"
  DROP COLUMN IF EXISTS "external_url",
  DROP COLUMN IF EXISTS "publication_name",
  DROP COLUMN IF EXISTS "duration_seconds",
  DROP COLUMN IF EXISTS "audio_url",
  DROP COLUMN IF EXISTS "episode_number",
  DROP COLUMN IF EXISTS "series",
  DROP COLUMN IF EXISTS "read_minutes_estimate",
  DROP COLUMN IF EXISTS "read_minutes",
  DROP COLUMN IF EXISTS "author_name",
  DROP COLUMN IF EXISTS "category";

DROP TYPE IF EXISTS "public"."shop_editorial_story_category";

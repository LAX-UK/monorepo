-- Editorial content the lax.art design needs: story bylines, categories, series, podcasts and
-- press; exhibition subtitles and contacts; venue city, street and coordinates; curated order on
-- the artist/artwork joins; and placement copy for the home and Art hub bands.
-- Every change is additive (nullable or defaulted), so an older shop-api keeps working.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TYPE "public"."shop_editorial_story_kind" ADD VALUE IF NOT EXISTS 'podcast';
--> statement-breakpoint
ALTER TYPE "public"."shop_editorial_placement_slot" ADD VALUE IF NOT EXISTS 'home_promo_bid';
--> statement-breakpoint
ALTER TYPE "public"."shop_editorial_placement_slot" ADD VALUE IF NOT EXISTS 'home_promo_shop';
--> statement-breakpoint
ALTER TYPE "public"."shop_editorial_placement_slot" ADD VALUE IF NOT EXISTS 'art_hub_now_on';
--> statement-breakpoint
ALTER TYPE "public"."shop_editorial_placement_slot" ADD VALUE IF NOT EXISTS 'art_hub_podcast';
--> statement-breakpoint
ALTER TYPE "public"."shop_editorial_placement_slot" ADD VALUE IF NOT EXISTS 'art_hub_films';
--> statement-breakpoint
ALTER TYPE "public"."shop_editorial_placement_slot" ADD VALUE IF NOT EXISTS 'art_hub_press';
--> statement-breakpoint
ALTER TYPE "public"."shop_editorial_placement_slot" ADD VALUE IF NOT EXISTS 'art_hub_feature';
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."shop_editorial_story_category" AS ENUM(
    'article',
    'artist_interview',
    'artist_conversation',
    'studio_visit',
    'film',
    'press',
    'podcast',
    'collecting_guide',
    'exhibition'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "shop_editorial_story"
  ADD COLUMN IF NOT EXISTS "category" "shop_editorial_story_category",
  ADD COLUMN IF NOT EXISTS "author_name" text,
  ADD COLUMN IF NOT EXISTS "read_minutes" integer,
  ADD COLUMN IF NOT EXISTS "read_minutes_estimate" integer,
  ADD COLUMN IF NOT EXISTS "series" text,
  ADD COLUMN IF NOT EXISTS "episode_number" integer,
  ADD COLUMN IF NOT EXISTS "audio_url" text,
  ADD COLUMN IF NOT EXISTS "duration_seconds" integer,
  ADD COLUMN IF NOT EXISTS "publication_name" text,
  ADD COLUMN IF NOT EXISTS "external_url" text;
--> statement-breakpoint
ALTER TABLE "shop_editorial_story" DROP CONSTRAINT IF EXISTS "shop_editorial_story_counts_chk";
--> statement-breakpoint
ALTER TABLE "shop_editorial_story" ADD CONSTRAINT "shop_editorial_story_counts_chk" CHECK (
  ("read_minutes" IS NULL OR "read_minutes" > 0)
  AND ("read_minutes_estimate" IS NULL OR "read_minutes_estimate" > 0)
  AND ("duration_seconds" IS NULL OR "duration_seconds" > 0)
  AND ("episode_number" IS NULL OR "episode_number" > 0)
);
--> statement-breakpoint
ALTER TABLE "shop_editorial_exhibition"
  ADD COLUMN IF NOT EXISTS "subtitle" text,
  ADD COLUMN IF NOT EXISTS "contact_name" text,
  ADD COLUMN IF NOT EXISTS "contact_role" text,
  ADD COLUMN IF NOT EXISTS "contact_email" text,
  ADD COLUMN IF NOT EXISTS "contact_phone" text,
  ADD COLUMN IF NOT EXISTS "contact_avatar_media_key" text;
--> statement-breakpoint
ALTER TABLE "shop_editorial_venue"
  ADD COLUMN IF NOT EXISTS "street_line" text,
  ADD COLUMN IF NOT EXISTS "city" text,
  ADD COLUMN IF NOT EXISTS "latitude" numeric(9, 6),
  ADD COLUMN IF NOT EXISTS "longitude" numeric(9, 6);
--> statement-breakpoint
ALTER TABLE "shop_editorial_venue" DROP CONSTRAINT IF EXISTS "shop_editorial_venue_coordinates_chk";
--> statement-breakpoint
ALTER TABLE "shop_editorial_venue" ADD CONSTRAINT "shop_editorial_venue_coordinates_chk" CHECK (
  ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90)
  AND ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180)
);
--> statement-breakpoint
ALTER TABLE "shop_editorial_exhibition_artist"
  ADD COLUMN IF NOT EXISTS "position" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "shop_editorial_story_artist"
  ADD COLUMN IF NOT EXISTS "position" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "shop_editorial_story_artwork"
  ADD COLUMN IF NOT EXISTS "position" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "shop_editorial_placement"
  ADD COLUMN IF NOT EXISTS "body" text,
  ADD COLUMN IF NOT EXISTS "cta_label" text;

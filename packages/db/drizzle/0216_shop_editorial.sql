CREATE TYPE "public"."shop_editorial_status" AS ENUM('draft', 'published');

CREATE TYPE "public"."shop_editorial_exhibition_kind" AS ENUM('exhibition', 'film', 'event');

CREATE TYPE "public"."shop_editorial_story_kind" AS ENUM('article', 'film', 'press', 'guide');

CREATE TYPE "public"."shop_editorial_placement_slot" AS ENUM(
  'home_hero',
  'home_whats_on',
  'home_stories',
  'home_guide',
  'art_hub_spotlight',
  'collector_hub_card'
);

CREATE TYPE "public"."shop_editorial_placement_ref_kind" AS ENUM(
  'exhibition',
  'story',
  'page',
  'venue',
  'external'
);

CREATE TYPE "public"."shop_general_enquiry_topic" AS ENUM(
  'general',
  'private_viewing',
  'art_advisory',
  'selling',
  'exhibition'
);

CREATE TABLE IF NOT EXISTS "shop_editorial_venue" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "status" "shop_editorial_status" DEFAULT 'draft' NOT NULL,
  "published_at" timestamp with time zone,
  "updated_by" text,
  "name" text NOT NULL,
  "address" text,
  "postcode" text,
  "opening_hours" jsonb,
  "phone" text,
  "email" text,
  "map_url" text,
  "cover_media_key" text,
  "body_blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "shop_editorial_venue_slug_uid"
  ON "shop_editorial_venue" ("slug");

CREATE TABLE IF NOT EXISTS "shop_editorial_exhibition" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "status" "shop_editorial_status" DEFAULT 'draft' NOT NULL,
  "published_at" timestamp with time zone,
  "updated_by" text,
  "kind" "shop_editorial_exhibition_kind" NOT NULL,
  "venue_id" uuid REFERENCES "shop_editorial_venue"("id") ON DELETE SET NULL,
  "title" text NOT NULL,
  "summary" text,
  "starts_on" date,
  "ends_on" date,
  "times_note" text,
  "cover_media_key" text,
  "featured" boolean DEFAULT false NOT NULL,
  "body_blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "shop_editorial_exhibition_slug_uid"
  ON "shop_editorial_exhibition" ("slug");

CREATE TABLE IF NOT EXISTS "shop_editorial_exhibition_artwork" (
  "exhibition_id" uuid NOT NULL REFERENCES "shop_editorial_exhibition"("id") ON DELETE CASCADE,
  "artwork_id" uuid NOT NULL REFERENCES "shop_artwork"("id") ON DELETE CASCADE,
  "position" integer NOT NULL,
  CONSTRAINT "shop_editorial_exhibition_artwork_pk" PRIMARY KEY ("exhibition_id", "position")
);

CREATE TABLE IF NOT EXISTS "shop_editorial_exhibition_artist" (
  "exhibition_id" uuid NOT NULL REFERENCES "shop_editorial_exhibition"("id") ON DELETE CASCADE,
  "artist_id" uuid NOT NULL REFERENCES "shop_artist"("id") ON DELETE CASCADE,
  CONSTRAINT "shop_editorial_exhibition_artist_pk" PRIMARY KEY ("exhibition_id", "artist_id")
);

CREATE TABLE IF NOT EXISTS "shop_editorial_exhibition_media" (
  "exhibition_id" uuid NOT NULL REFERENCES "shop_editorial_exhibition"("id") ON DELETE CASCADE,
  "media_key" text NOT NULL,
  "position" integer NOT NULL,
  "caption" text,
  CONSTRAINT "shop_editorial_exhibition_media_pk" PRIMARY KEY ("exhibition_id", "position")
);

CREATE TABLE IF NOT EXISTS "shop_editorial_story" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "status" "shop_editorial_status" DEFAULT 'draft' NOT NULL,
  "published_at" timestamp with time zone,
  "updated_by" text,
  "kind" "shop_editorial_story_kind" NOT NULL,
  "title" text NOT NULL,
  "standfirst" text,
  "cover_media_key" text,
  "video_url" text,
  "featured" boolean DEFAULT false NOT NULL,
  "body_blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "shop_editorial_story_slug_uid"
  ON "shop_editorial_story" ("slug");

CREATE TABLE IF NOT EXISTS "shop_editorial_story_artist" (
  "story_id" uuid NOT NULL REFERENCES "shop_editorial_story"("id") ON DELETE CASCADE,
  "artist_id" uuid NOT NULL REFERENCES "shop_artist"("id") ON DELETE CASCADE,
  CONSTRAINT "shop_editorial_story_artist_pk" PRIMARY KEY ("story_id", "artist_id")
);

CREATE TABLE IF NOT EXISTS "shop_editorial_story_artwork" (
  "story_id" uuid NOT NULL REFERENCES "shop_editorial_story"("id") ON DELETE CASCADE,
  "artwork_id" uuid NOT NULL REFERENCES "shop_artwork"("id") ON DELETE CASCADE,
  CONSTRAINT "shop_editorial_story_artwork_pk" PRIMARY KEY ("story_id", "artwork_id")
);

CREATE TABLE IF NOT EXISTS "shop_editorial_story_exhibition" (
  "story_id" uuid NOT NULL REFERENCES "shop_editorial_story"("id") ON DELETE CASCADE,
  "exhibition_id" uuid NOT NULL REFERENCES "shop_editorial_exhibition"("id") ON DELETE CASCADE,
  CONSTRAINT "shop_editorial_story_exhibition_pk" PRIMARY KEY ("story_id", "exhibition_id")
);

CREATE TABLE IF NOT EXISTS "shop_editorial_page" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "status" "shop_editorial_status" DEFAULT 'draft' NOT NULL,
  "published_at" timestamp with time zone,
  "updated_by" text,
  "title" text NOT NULL,
  "body_blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "shop_editorial_page_slug_uid"
  ON "shop_editorial_page" ("slug");

CREATE TABLE IF NOT EXISTS "shop_editorial_placement" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slot" "shop_editorial_placement_slot" NOT NULL,
  "position" integer NOT NULL,
  "ref_kind" "shop_editorial_placement_ref_kind" NOT NULL,
  "ref_id" uuid,
  "headline" text,
  "media_key" text,
  "link_url" text,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "shop_editorial_placement_slot_position_uid"
  ON "shop_editorial_placement" ("slot", "position");

CREATE TABLE IF NOT EXISTS "shop_general_enquiry" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "identity_subject_id" text NOT NULL,
  "topic" "shop_general_enquiry_topic" NOT NULL,
  "context_slug" text,
  "message" text NOT NULL,
  "phone" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "shop_general_enquiry_subject_idx"
  ON "shop_general_enquiry" ("identity_subject_id", "created_at" DESC);

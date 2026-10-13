CREATE TYPE "public"."shop_media_kind" AS ENUM(
  'artwork_image',
  'artist_portrait',
  'artist_hero',
  'editorial_cover',
  'editorial_inline',
  'venue_image'
);
--> statement-breakpoint
CREATE TYPE "public"."shop_media_asset_status" AS ENUM('pending', 'active', 'rejected');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_media_asset" (
  "key" text PRIMARY KEY NOT NULL,
  "kind" "shop_media_kind" NOT NULL,
  "status" "shop_media_asset_status" DEFAULT 'pending' NOT NULL,
  "content_type" text NOT NULL,
  "byte_size" integer NOT NULL,
  "width" integer,
  "height" integer,
  "blur_data_url" text,
  "alt" text,
  "created_by_subject_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_media_asset_status_kind_idx"
  ON "shop_media_asset" USING btree ("status", "kind");

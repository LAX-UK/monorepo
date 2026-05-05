CREATE TABLE IF NOT EXISTS "artist_profile" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "display_name" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "portrait_url" text,
  "hero_image_url" text,
  "short_bio" text,
  "long_bio" text,
  "statement" text,
  "nationality" text,
  "location" text,
  "birth_year" text,
  "death_year" text,
  "website_url" text,
  "social_links" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "featured" boolean NOT NULL DEFAULT false,
  "verified" boolean NOT NULL DEFAULT false,
  "archived" boolean NOT NULL DEFAULT false,
  "owner_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "artist_profile_archived_idx" ON "artist_profile" ("archived");
CREATE INDEX IF NOT EXISTS "artist_profile_featured_idx" ON "artist_profile" ("featured");
CREATE INDEX IF NOT EXISTS "artist_profile_owner_user_id_idx" ON "artist_profile" ("owner_user_id");
CREATE INDEX IF NOT EXISTS "artist_profile_slug_idx" ON "artist_profile" ("slug");

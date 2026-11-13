-- The picture staff choose to lead the LAX Shop home's first screen, with its alt text, where the
-- subject sits and what was measured from the picture so the type stays readable on it. One row
-- at most; with no row the home leads with the newest edition as before. Additive: a new table
-- that nothing reads until the new release is running.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_home_cover" (
  "id" text PRIMARY KEY DEFAULT 'home' NOT NULL,
  "media_key" text NOT NULL,
  "width" integer NOT NULL,
  "height" integer NOT NULL,
  "blur_data_url" text,
  "focal_x" double precision NOT NULL,
  "focal_y" double precision NOT NULL,
  "alt" text NOT NULL,
  "analysis" jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_by_subject_id" text,
  CONSTRAINT "shop_home_cover_single_row" CHECK ("id" = 'home'),
  CONSTRAINT "shop_home_cover_size" CHECK ("width" > 0 AND "height" > 0),
  CONSTRAINT "shop_home_cover_focal_range" CHECK ("focal_x" BETWEEN 0 AND 1 AND "focal_y" BETWEEN 0 AND 1),
  CONSTRAINT "shop_home_cover_alt_length" CHECK (char_length("alt") BETWEEN 1 AND 500)
);

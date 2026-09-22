DO $$ BEGIN
  CREATE TYPE "shop_sale_state" AS ENUM (
    'for_sale',
    'price_on_application',
    'sold'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "shop_placement_slot" AS ENUM (
    'featured_originals',
    'featured_categories',
    'featured_prints',
    'featured_artists'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "shop_artist"
  ADD COLUMN IF NOT EXISTS "portrait_image_url" text,
  ADD COLUMN IF NOT EXISTS "discipline" text,
  ADD COLUMN IF NOT EXISTS "bio" text;
--> statement-breakpoint
ALTER TABLE "shop_artwork"
  ADD COLUMN IF NOT EXISTS "dimensions" text,
  ADD COLUMN IF NOT EXISTS "year_created" integer,
  ADD COLUMN IF NOT EXISTS "sale_state" "shop_sale_state" DEFAULT 'for_sale' NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_category" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "label" text NOT NULL,
  "cover_image_url" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_category_slug_uid" ON "shop_category" ("slug");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_artwork_category" (
  "artwork_id" uuid NOT NULL,
  "category_id" uuid NOT NULL,
  CONSTRAINT "shop_artwork_category_pk" PRIMARY KEY ("artwork_id", "category_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_artwork_category_category_idx" ON "shop_artwork_category" ("category_id");
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shop_artwork_category"
    ADD CONSTRAINT "shop_artwork_category_artwork_id_shop_artwork_id_fk"
    FOREIGN KEY ("artwork_id") REFERENCES "shop_artwork"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shop_artwork_category"
    ADD CONSTRAINT "shop_artwork_category_category_id_shop_category_id_fk"
    FOREIGN KEY ("category_id") REFERENCES "shop_category"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_home_placement" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slot" "shop_placement_slot" NOT NULL,
  "position" integer NOT NULL,
  "artwork_id" uuid,
  "artist_id" uuid,
  "category_id" uuid,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "shop_home_placement_position_nonnegative" CHECK ("position" >= 0),
  CONSTRAINT "shop_home_placement_target_arc" CHECK (
    (
      "slot" IN ('featured_originals', 'featured_prints')
      AND "artwork_id" IS NOT NULL
      AND "artist_id" IS NULL
      AND "category_id" IS NULL
    )
    OR (
      "slot" = 'featured_categories'
      AND "artwork_id" IS NULL
      AND "artist_id" IS NULL
      AND "category_id" IS NOT NULL
    )
    OR (
      "slot" = 'featured_artists'
      AND "artwork_id" IS NULL
      AND "artist_id" IS NOT NULL
      AND "category_id" IS NULL
    )
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_home_placement_slot_position_uid" ON "shop_home_placement" ("slot", "position");
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shop_home_placement"
    ADD CONSTRAINT "shop_home_placement_artwork_id_shop_artwork_id_fk"
    FOREIGN KEY ("artwork_id") REFERENCES "shop_artwork"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shop_home_placement"
    ADD CONSTRAINT "shop_home_placement_artist_id_shop_artist_id_fk"
    FOREIGN KEY ("artist_id") REFERENCES "shop_artist"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shop_home_placement"
    ADD CONSTRAINT "shop_home_placement_category_id_shop_category_id_fk"
    FOREIGN KEY ("category_id") REFERENCES "shop_category"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "shop_edition_allocation" AS ENUM (
    'original_buyer_entitlement',
    'artist',
    'lax'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_party" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "display_name" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_artist" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "party_id" uuid NOT NULL,
  "slug" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_artist_slug_uid" ON "shop_artist" ("slug");
--> statement-breakpoint
ALTER TABLE "shop_artist"
  ADD CONSTRAINT "shop_artist_party_id_shop_party_id_fk"
  FOREIGN KEY ("party_id") REFERENCES "shop_party"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_artwork" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "artist_id" uuid NOT NULL,
  "eligible_for_edition_allocation" boolean NOT NULL,
  "import_key" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_artwork_slug_uid" ON "shop_artwork" ("slug");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_artwork_import_key_uid" ON "shop_artwork" ("import_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_artwork_artist_idx" ON "shop_artwork" ("artist_id");
--> statement-breakpoint
ALTER TABLE "shop_artwork"
  ADD CONSTRAINT "shop_artwork_artist_id_shop_artist_id_fk"
  FOREIGN KEY ("artist_id") REFERENCES "shop_artist"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_edition" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "artwork_id" uuid NOT NULL,
  "edition_number" integer NOT NULL,
  "allocation" "shop_edition_allocation" NOT NULL,
  "owner_party_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_edition_artwork_number_uid"
  ON "shop_edition" ("artwork_id", "edition_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_edition_artwork_idx" ON "shop_edition" ("artwork_id");
--> statement-breakpoint
ALTER TABLE "shop_edition"
  ADD CONSTRAINT "shop_edition_artwork_id_shop_artwork_id_fk"
  FOREIGN KEY ("artwork_id") REFERENCES "shop_artwork"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "shop_edition"
  ADD CONSTRAINT "shop_edition_owner_party_id_shop_party_id_fk"
  FOREIGN KEY ("owner_party_id") REFERENCES "shop_party"("id") ON DELETE set null ON UPDATE no action;

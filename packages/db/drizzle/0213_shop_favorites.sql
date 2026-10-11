CREATE TABLE IF NOT EXISTS "shop_saved_artwork" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "identity_subject_id" text NOT NULL,
  "artwork_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "shop_saved_artwork_artwork_id_shop_artwork_id_fk" FOREIGN KEY ("artwork_id") REFERENCES "public"."shop_artwork"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_saved_artwork_subject_artwork_uid"
  ON "shop_saved_artwork" USING btree ("identity_subject_id", "artwork_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_saved_artwork_subject_idx"
  ON "shop_saved_artwork" USING btree ("identity_subject_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_followed_artist" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "identity_subject_id" text NOT NULL,
  "artist_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "shop_followed_artist_artist_id_shop_artist_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."shop_artist"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_followed_artist_subject_artist_uid"
  ON "shop_followed_artist" USING btree ("identity_subject_id", "artist_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_followed_artist_subject_idx"
  ON "shop_followed_artist" USING btree ("identity_subject_id");

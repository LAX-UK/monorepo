-- Lot marketing JSON (estimate, provenance, condition report, image alts)
ALTER TABLE "lot" ADD COLUMN IF NOT EXISTS "marketing_details" jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Watch public artist profiles (mirrors lot watchlist pattern)
CREATE TABLE IF NOT EXISTS "artist_watchlist" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "artist_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "artist_watchlist_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "artist_watchlist_artist_id_user_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "artist_watchlist_user_artist_uid" UNIQUE ("user_id","artist_id")
);

CREATE INDEX IF NOT EXISTS "artist_watchlist_user_id_idx" ON "artist_watchlist" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "artist_watchlist_artist_id_idx" ON "artist_watchlist" USING btree ("artist_id");

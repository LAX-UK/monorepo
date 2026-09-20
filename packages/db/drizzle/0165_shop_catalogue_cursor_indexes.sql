CREATE INDEX IF NOT EXISTS "shop_artwork_created_id_idx"
  ON "shop_artwork" ("created_at" DESC, "id" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_artist_created_id_idx"
  ON "shop_artist" ("created_at" DESC, "id" DESC);

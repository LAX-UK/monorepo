CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_artwork_title_trgm_idx" ON "shop_artwork" USING gin ("title" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_artwork_slug_trgm_idx" ON "shop_artwork" USING gin ("slug" gin_trgm_ops);

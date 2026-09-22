CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_party_display_name_trgm_idx" ON "shop_party" USING gin ("display_name" gin_trgm_ops);

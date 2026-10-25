-- Links a Shop edition to the original artwork it was made from, so the edition's page can link to
-- the original on lax.art and the original's page can list its editions.
-- Additive and nullable: existing artworks have no link, and an older shop-api keeps working.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "shop_artwork" ADD COLUMN IF NOT EXISTS "source_original_artwork_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shop_artwork" ADD CONSTRAINT "shop_artwork_source_original_artwork_id_shop_artwork_id_fk" FOREIGN KEY ("source_original_artwork_id") REFERENCES "public"."shop_artwork"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "shop_artwork" DROP CONSTRAINT IF EXISTS "shop_artwork_source_original_not_self";
--> statement-breakpoint
ALTER TABLE "shop_artwork" ADD CONSTRAINT "shop_artwork_source_original_not_self" CHECK ("source_original_artwork_id" IS NULL OR "source_original_artwork_id" <> "id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_artwork_source_original_idx" ON "shop_artwork" USING btree ("source_original_artwork_id");

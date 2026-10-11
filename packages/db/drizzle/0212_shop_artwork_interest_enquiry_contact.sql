ALTER TABLE "shop_artwork_interest"
  ADD COLUMN IF NOT EXISTS "message" text;
--> statement-breakpoint
ALTER TABLE "shop_artwork_interest"
  ADD COLUMN IF NOT EXISTS "contact_phone" text;

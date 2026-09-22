DROP INDEX IF EXISTS "shop_artwork_interest_artwork_subject_intent_uid";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_artwork_interest_artwork_subject_uid" ON "shop_artwork_interest" USING btree ("artwork_id","identity_subject_id");
--> statement-breakpoint
ALTER TABLE "shop_artwork_interest" DROP COLUMN IF EXISTS "intent";
--> statement-breakpoint
DROP TYPE IF EXISTS "public"."shop_artwork_interest_intent";

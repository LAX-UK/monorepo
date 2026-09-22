DO $$ BEGIN
 CREATE TYPE "public"."shop_artwork_interest_intent" AS ENUM('notify_me', 'enquiry');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "shop_artwork_interest" ADD COLUMN IF NOT EXISTS "intent" "shop_artwork_interest_intent" DEFAULT 'notify_me' NOT NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS "shop_artwork_interest_artwork_subject_uid";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_artwork_interest_artwork_subject_intent_uid" ON "shop_artwork_interest" USING btree ("artwork_id","identity_subject_id","intent");

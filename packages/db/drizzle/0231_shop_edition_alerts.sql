-- Edition alerts ("email me if this edition is back") work without signing in. An alert is keyed
-- by its email address, and by the account too when the person is signed in. A person can stop an
-- alert, and every alert email carries an unsubscribe link whose token is stored only as a hash.
-- Additive for an older shop-api: it ignores the new columns, and its insert still dedupes
-- through the partial unique indexes below.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "shop_artwork_interest" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "shop_artwork_interest" ADD COLUMN IF NOT EXISTS "unsubscribe_token_hash" text;
--> statement-breakpoint
ALTER TABLE "shop_artwork_interest" DROP CONSTRAINT IF EXISTS "shop_artwork_interest_alert_columns_ck";
--> statement-breakpoint
ALTER TABLE "shop_artwork_interest" ADD CONSTRAINT "shop_artwork_interest_alert_columns_ck" CHECK ("intent" = 'notify_me' OR ("cancelled_at" IS NULL AND "unsubscribe_token_hash" IS NULL));
--> statement-breakpoint
-- The old index kept one row per account and intent for ever, so a sent or stopped alert blocked
-- a new one. Enquiries keep that rule; alerts are unique only while they are waiting.
DROP INDEX IF EXISTS "shop_artwork_interest_artwork_subject_intent_uid";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_artwork_interest_enquiry_subject_uid" ON "shop_artwork_interest" USING btree ("artwork_id","identity_subject_id") WHERE "intent" = 'enquiry';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_artwork_interest_alert_subject_uid" ON "shop_artwork_interest" USING btree ("artwork_id","identity_subject_id") WHERE "intent" = 'notify_me' AND "notified_at" IS NULL AND "cancelled_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_artwork_interest_alert_email_uid" ON "shop_artwork_interest" USING btree ("artwork_id",lower("contact_email")) WHERE "intent" = 'notify_me' AND "notified_at" IS NULL AND "cancelled_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_artwork_interest_alert_email_idx" ON "shop_artwork_interest" USING btree (lower("contact_email")) WHERE "intent" = 'notify_me';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_artwork_interest_unsubscribe_token_uid" ON "shop_artwork_interest" USING btree ("unsubscribe_token_hash") WHERE "unsubscribe_token_hash" IS NOT NULL;

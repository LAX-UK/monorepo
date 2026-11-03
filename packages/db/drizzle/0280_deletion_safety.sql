-- A person who has asked to delete their account must not take on anything new while the request
-- stands, and the daily purge must re-check what they still have open before it erases them.
--
-- Identity records when a purge was held and why, and when the 7-day reminder went out so it is
-- sent once. Each product keeps its own copy of what it needs to enforce the rule at the point of
-- commitment: Bid already mirrors the request date in bid_identity_directory and now also the
-- hold (so staff can see it); Shop mirrors the request date in shop_user_profile.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "deletion_held_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "deletion_hold_reasons" jsonb;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "deletion_reminder_sent_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "bid_identity_directory" ADD COLUMN IF NOT EXISTS "deletion_held_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "bid_identity_directory" ADD COLUMN IF NOT EXISTS "deletion_hold_reasons" jsonb;
--> statement-breakpoint
ALTER TABLE "shop_user_profile" ADD COLUMN IF NOT EXISTS "deletion_requested_at" timestamp with time zone;
--> statement-breakpoint
-- Requests already under way when this ships: both products mirror the same Identity events, so
-- Bid's copy is the starting point for Shop's.
UPDATE "shop_user_profile" AS profile
SET "deletion_requested_at" = directory."deletion_requested_at"
FROM "bid_identity_directory" AS directory
WHERE directory."subject_id" = profile."identity_subject_id"
  AND directory."deletion_requested_at" IS NOT NULL
  AND profile."deletion_requested_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bid_identity_directory_deletion_held_idx"
  ON "bid_identity_directory" ("deletion_held_at")
  WHERE "deletion_held_at" IS NOT NULL;

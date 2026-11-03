-- Rollback for 0280_deletion_safety. Roll back the application release first: the previous
-- release neither writes nor reads these columns, so dropping them loses only the hold records,
-- the reminder marker and Shop's copy of the request date (rebuilt from Identity events).
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
DROP INDEX IF EXISTS "bid_identity_directory_deletion_held_idx";
--> statement-breakpoint
ALTER TABLE "shop_user_profile" DROP COLUMN IF EXISTS "deletion_requested_at";
--> statement-breakpoint
ALTER TABLE "bid_identity_directory" DROP COLUMN IF EXISTS "deletion_hold_reasons";
--> statement-breakpoint
ALTER TABLE "bid_identity_directory" DROP COLUMN IF EXISTS "deletion_held_at";
--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN IF EXISTS "deletion_reminder_sent_at";
--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN IF EXISTS "deletion_hold_reasons";
--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN IF EXISTS "deletion_held_at";

-- Rollback for 0352_account_time_zone. Roll back the application release first: the previous
-- release neither reads nor writes these columns, and reads quiet hours from
-- "notification_preference.quiet_time_zone", which this migration leaves in place. A zone a person
-- chose in LAX Account is dropped with the columns.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "bid_identity_directory" DROP COLUMN IF EXISTS "time_zone";
--> statement-breakpoint
ALTER TABLE "bid_identity_directory" DROP COLUMN IF EXISTS "time_zone_mode";
--> statement-breakpoint
ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_fixed_time_zone_present";
--> statement-breakpoint
ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_time_zone_names_a_place";
--> statement-breakpoint
ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_time_zone_mode_valid";
--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN IF EXISTS "time_zone_reported_at";
--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN IF EXISTS "time_zone";
--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN IF EXISTS "time_zone_mode";

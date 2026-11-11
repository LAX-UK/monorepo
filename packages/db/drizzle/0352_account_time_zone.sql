-- LAX Account keeps one time zone per person, used for their emails and for the times shown to
-- them in every LAX product. "time_zone_mode" is "automatic" (follow the device: "time_zone" holds
-- the zone that device last reported, or null before it has) or "fixed" (always use "time_zone").
-- The zone must be a place ("Region/City"), never UTC or an "Etc/*" fixed offset; the application
-- also checks the name against the runtime's zone list.
-- "time_zone_reported_at" is when a device last changed the automatic zone; devices report at most
-- once a day. The identity "user" row is the source. "bid_identity_directory" is Bid's read copy,
-- kept current by the identity profile event.
-- Nobody is backfilled: everyone starts on "automatic" with no zone yet, and quiet hours keep
-- using the zone saved with them (notification_preference.quiet_time_zone) until Account has one.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "time_zone_mode" text NOT NULL DEFAULT 'automatic';
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "time_zone" text;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "time_zone_reported_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_time_zone_mode_valid";
--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_time_zone_mode_valid" CHECK ("time_zone_mode" IN ('automatic', 'fixed'));
--> statement-breakpoint
ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_time_zone_names_a_place";
--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_time_zone_names_a_place" CHECK ("time_zone" IS NULL OR (position('/' in "time_zone") > 1 AND "time_zone" NOT LIKE 'Etc/%'));
--> statement-breakpoint
ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_fixed_time_zone_present";
--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_fixed_time_zone_present" CHECK ("time_zone_mode" <> 'fixed' OR "time_zone" IS NOT NULL);
--> statement-breakpoint
ALTER TABLE "bid_identity_directory" ADD COLUMN IF NOT EXISTS "time_zone_mode" text NOT NULL DEFAULT 'automatic';
--> statement-breakpoint
ALTER TABLE "bid_identity_directory" ADD COLUMN IF NOT EXISTS "time_zone" text;
--> statement-breakpoint

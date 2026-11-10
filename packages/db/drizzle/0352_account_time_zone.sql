-- LAX Account keeps one time zone per person, used for their emails and for the times shown to
-- them in every LAX product. "time_zone_mode" is "automatic" (follow the device: "time_zone" holds
-- the zone that device last reported, or null before it has) or "fixed" (always use "time_zone").
-- The zone must be a place ("Region/City"), never UTC or an "Etc/*" fixed offset; the application
-- also checks the name against the runtime's zone list.
-- The identity "user" row is the source. "bid_identity_directory" is Bid's read copy, kept current
-- by the identity profile event; it is backfilled here so quiet hours work before any new event.
-- People who already chose quiet hours keep the zone those hours were set in: it becomes their
-- fixed Account zone. Everyone else starts on "automatic" with no zone yet.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "time_zone_mode" text NOT NULL DEFAULT 'automatic';
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "time_zone" text;
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
UPDATE "user" AS u
SET "time_zone_mode" = 'fixed', "time_zone" = np."quiet_time_zone"
FROM "notification_preference" AS np
WHERE np."user_id" = u."id"
  AND np."quiet_start" IS NOT NULL
  AND np."quiet_end" IS NOT NULL
  AND position('/' in np."quiet_time_zone") > 1
  AND np."quiet_time_zone" NOT LIKE 'Etc/%'
  AND u."time_zone" IS NULL;
--> statement-breakpoint
UPDATE "bid_identity_directory" AS d
SET "time_zone_mode" = u."time_zone_mode", "time_zone" = u."time_zone"
FROM "user" AS u
WHERE d."subject_id" = u."id"
  AND u."time_zone" IS NOT NULL;

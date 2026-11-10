-- Each sale quotes its times in one official IANA time zone. Existing sales were all scheduled in
-- London, so the default backfills every row to Europe/London. The column only names a zone: every
-- moment stays a timestamptz instant. The check keeps out an empty or offset-style value; the
-- application validates the name against the runtime's zone list.
-- `first_published_at` records the first time a sale left draft. A published sale's zone is fixed
-- for good: unpublishing back to draft must not reopen it, because the times already sent to
-- bidders are quoted in it. Sales that are published today are stamped with their last update.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN IF NOT EXISTS "first_published_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "sale" SET "first_published_at" = "updated_at" WHERE "status" <> 'draft' AND "first_published_at" IS NULL;
--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN IF NOT EXISTS "time_zone" text NOT NULL DEFAULT 'Europe/London';
--> statement-breakpoint
ALTER TABLE "sale" DROP CONSTRAINT IF EXISTS "sale_time_zone_names_a_place";
--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_time_zone_names_a_place" CHECK (position('/' in "time_zone") > 1 AND "time_zone" NOT LIKE 'Etc/%');

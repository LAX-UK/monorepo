-- Each sale quotes its times in one official IANA time zone. Existing sales were all scheduled in
-- London, so the default backfills every row to Europe/London. The column only names a zone: every
-- moment stays a timestamptz instant. The check keeps out an empty or offset-style value; the
-- application validates the name against the runtime's zone list.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN IF NOT EXISTS "time_zone" text NOT NULL DEFAULT 'Europe/London';
--> statement-breakpoint
ALTER TABLE "sale" DROP CONSTRAINT IF EXISTS "sale_time_zone_names_a_place";
--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_time_zone_names_a_place" CHECK (position('/' in "time_zone") > 1 AND "time_zone" NOT LIKE 'Etc/%');

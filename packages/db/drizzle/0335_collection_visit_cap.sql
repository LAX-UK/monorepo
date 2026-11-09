-- The most collection visits one account may have booked at once. Additive: a column with a
-- default on a table nothing outside collection booking reads, so running services keep working.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "collection_place" ADD COLUMN IF NOT EXISTS "max_active_visits" smallint DEFAULT 5 NOT NULL;
--> statement-breakpoint
ALTER TABLE "collection_place" DROP CONSTRAINT IF EXISTS "collection_place_visit_cap_check";
--> statement-breakpoint
ALTER TABLE "collection_place" ADD CONSTRAINT "collection_place_visit_cap_check" CHECK ("max_active_visits" BETWEEN 1 AND 20);

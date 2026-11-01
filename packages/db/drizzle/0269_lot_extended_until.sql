-- A late bid can extend a lot's close (anti-sniping). The lot page shows that it was extended, so
-- the extended end is recorded when it happens instead of being guessed from the schedule.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "lot"
  ADD COLUMN IF NOT EXISTS "extended_until" timestamp with time zone;

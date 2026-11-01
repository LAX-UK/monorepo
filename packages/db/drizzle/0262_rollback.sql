-- Rollback for 0262_quiet_hours_time_zone. Roll back the application release first: the previous
-- release reads quiet hours as UTC. Times are converted back from each person's zone to UTC at
-- today's offset, then the zone column is dropped.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
UPDATE "notification_preference"
SET
  "quiet_start" = to_char(
    ((current_date + "quiet_start"::time) AT TIME ZONE "quiet_time_zone") AT TIME ZONE 'UTC',
    'HH24:MI'
  ),
  "quiet_end" = to_char(
    ((current_date + "quiet_end"::time) AT TIME ZONE "quiet_time_zone") AT TIME ZONE 'UTC',
    'HH24:MI'
  )
WHERE "quiet_start" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  AND "quiet_end" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$';
--> statement-breakpoint
ALTER TABLE "notification_preference" DROP COLUMN IF EXISTS "quiet_time_zone";

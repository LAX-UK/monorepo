-- Quiet hours in the person's own time. Until now "quiet_start" and "quiet_end" held UTC times,
-- so a window chosen in London moved by an hour with each clock change. They now hold local
-- "HH:MM" in "quiet_time_zone" (an IANA name, London by default), and delivery checks them in that
-- zone. Existing values are converted from UTC to London time at today's offset, which is the
-- time Bid settings showed the person when they saved them.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "notification_preference"
  ADD COLUMN IF NOT EXISTS "quiet_time_zone" text DEFAULT 'Europe/London' NOT NULL;
--> statement-breakpoint
UPDATE "notification_preference"
SET
  "quiet_start" = to_char(
    ((current_date + "quiet_start"::time) AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/London',
    'HH24:MI'
  ),
  "quiet_end" = to_char(
    ((current_date + "quiet_end"::time) AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/London',
    'HH24:MI'
  )
WHERE "quiet_start" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  AND "quiet_end" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$';

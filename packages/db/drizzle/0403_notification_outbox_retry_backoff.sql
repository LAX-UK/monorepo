-- notification_outbox gains last_attempt_at: when a row's last failed attempt ended. The drain only
-- claims a failed row again once a backoff has passed since then (15 s doubling to 5 min), so drains
-- woken every few hundred milliseconds by a live sale cannot use up a row's ten attempts during a
-- short outage. Rows that never failed keep a NULL and are claimed as before.
-- Additive: the running release neither reads nor writes the column and keeps working until it
-- restarts.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD COLUMN IF NOT EXISTS "last_attempt_at" timestamp with time zone;

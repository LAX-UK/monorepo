-- The LAX Shop release list moved onto the alert engine in 0292, with the same ids, states and
-- consent records. Nothing reads or writes the old table any more, so it goes, together with the
-- stored plain stop tokens it held. shop_alert_subscriber is untouched.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
DROP TABLE IF EXISTS "shop_release_alert_subscription";

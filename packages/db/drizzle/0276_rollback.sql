-- Rollback for 0276_shop_release_alerts. Roll back the application release first: the previous
-- release neither reads nor writes this table. Release alert subscriptions are lost.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
DROP TABLE IF EXISTS "shop_release_alert_subscription";

-- Rollback for 0292_shop_alert_engine. Roll back the application release first: the previous
-- release neither reads nor writes these tables. Subscribers, topic switches, matches, digests
-- and announcements are lost. People who joined the release list before the engine are still in
-- shop_release_alert_subscription as they were at the move; sign-ups, confirmations and stops made
-- after it are not copied back, so replay them from shop_alert_subscriber first if any matter.
SET LOCAL lock_timeout = '30s';

DROP TABLE IF EXISTS "shop_alert_match";
DROP TABLE IF EXISTS "shop_alert_digest";
DROP TABLE IF EXISTS "shop_alert_topic";
DROP TABLE IF EXISTS "shop_alert_announcement";
DROP TABLE IF EXISTS "shop_alert_subscriber";

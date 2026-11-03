-- Rollback for 0290_alert_followers. The previous release sends no artist or search emails, so
-- nothing needs undoing for it to run. This removes the topic switches and subscriptions the
-- migration created; a person who changed a switch afterwards loses that choice too.
SET LOCAL lock_timeout = '30s';

DELETE FROM "bid_alert_topic"
WHERE "topic" IN ('bid.artists', 'bid.searches') AND "changed_by" = 'migration';

DELETE FROM "bid_alert_subscriber" x
WHERE x."consent_source" IN ('bid_follow_migration', 'bid_follow', 'bid_saved_search')
  AND NOT EXISTS (SELECT 1 FROM "bid_alert_topic" t WHERE t."subscriber_id" = x."id");

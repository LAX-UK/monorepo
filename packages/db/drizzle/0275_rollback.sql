-- Rollback for 0275_visitor_sale_alerts. Stop the visitor alert sign-up routes first (roll back
-- the API); the list of subscribers and their consent records is lost.
SET LOCAL lock_timeout = '30s';

DROP TABLE IF EXISTS "visitor_sale_alert_subscriber";

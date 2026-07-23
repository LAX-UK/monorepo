-- Rollback: domain_event_delivery + milestone idempotency indexes (0132_domain_event_delivery.sql)
DROP INDEX IF EXISTS "domain_events_user_linked_external_uid";
DROP INDEX IF EXISTS "domain_events_bid_outbid_uid";
DROP INDEX IF EXISTS "domain_events_bid_first_for_user_uid";

DROP TABLE IF EXISTS "domain_event_delivery";

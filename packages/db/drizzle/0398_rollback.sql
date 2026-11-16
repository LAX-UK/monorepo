-- Rollback for 0398_domain_events_event_type_aggregate_idx. Only drops the index; no data changes
-- and the application needs no rollback (readers fall back to the older indexes). Roll back
-- 0399_rollback.sql first. Also removes this migration's ledger row so a later deploy reapplies it.
-- DROP INDEX takes an ACCESS EXCLUSIVE lock for the moment of the drop; to avoid even that, run
--   DROP INDEX CONCURRENTLY IF EXISTS "domain_events_event_type_aggregate_id_idx";
-- outside a transaction first, then this file.
BEGIN;

SET LOCAL lock_timeout = '5s';
DROP INDEX IF EXISTS "domain_events_event_type_aggregate_id_idx";

DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1812628800000;

COMMIT;

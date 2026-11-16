-- Rollback for 0399_unapplied_money_shop_payment_idx. Only drops the two indexes; no data changes
-- and the application needs no rollback (existsForShopPayment walks the 0384 index again). Roll
-- this back before 0398_rollback.sql. Also removes this migration's ledger row so a later deploy
-- reapplies it. To avoid the brief ACCESS EXCLUSIVE lock of DROP INDEX, run
--   DROP INDEX CONCURRENTLY IF EXISTS "domain_events_unapplied_money_session_idx";
--   DROP INDEX CONCURRENTLY IF EXISTS "domain_events_unapplied_money_intent_idx";
-- outside a transaction first, then this file.
BEGIN;

SET LOCAL lock_timeout = '5s';
DROP INDEX IF EXISTS "domain_events_unapplied_money_session_idx";
DROP INDEX IF EXISTS "domain_events_unapplied_money_intent_idx";

DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1812715200000;

COMMIT;

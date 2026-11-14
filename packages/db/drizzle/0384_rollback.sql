-- Rollback for 0384_unapplied_money_dedupe_key_uid. Deduplication falls back to the recorder's
-- advisory lock and existence check, as before. Also removes this migration's ledger row so a
-- later deploy reapplies it. Roll this back before 0383_rollback.sql (0383 is #1366's Shop
-- invoices migration); it does not depend on 0383.
BEGIN;

SET LOCAL lock_timeout = '5s';
DROP INDEX IF EXISTS "domain_events_unapplied_money_dedupe_key_uid";

DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1811332800000;

COMMIT;

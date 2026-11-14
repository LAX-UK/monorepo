-- Rollback for 0383_unapplied_money_dedupe_key_uid. Deduplication falls back to the recorder's
-- advisory lock and existence check, as before. Also removes this migration's ledger row so a
-- later deploy reapplies it.
BEGIN;

SET LOCAL lock_timeout = '5s';
DROP INDEX IF EXISTS "domain_events_unapplied_money_dedupe_key_uid";

DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1811246400000;

COMMIT;

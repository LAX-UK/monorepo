-- Rollback for 0398_demo_seed_target. Roll the application release back first: the earlier
-- release does not read this table. The mark on test is lost and must be inserted again if the
-- migration is reapplied. Removes this migration's ledger row so a later deploy reapplies it.
BEGIN;

SET LOCAL lock_timeout = '30s';
DROP TABLE IF EXISTS "demo_seed_target";

DELETE FROM drizzle."__drizzle_migrations"
 WHERE "created_at" = 1812628800000;

COMMIT;

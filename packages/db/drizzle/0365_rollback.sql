-- Rollback for 0365_session_lifetime_indexes. Roll back the application release first: the
-- previous release does not end records for idleness or age. Rolling back only drops the index;
-- no data changes.
--
-- Also remove the migration's row from the ledger, or re-applying 0365 later will be skipped as
-- already applied:
--   DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1806566400000;
-- (1806566400000 is the "when" of this migration in meta/_journal.json; look the row up first.)
BEGIN;
SET LOCAL lock_timeout = '5s';

DROP INDEX IF EXISTS "session_signed_in_idx";
DROP INDEX IF EXISTS "session_last_active_idx";
COMMIT;

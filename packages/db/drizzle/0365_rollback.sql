-- Rollback for 0365_session_lifetime_indexes. Roll back the application release first: the
-- previous release does not end records for idleness or age. Rolling back only drops the indexes;
-- no data changes.
SET LOCAL lock_timeout = '5s';

DROP INDEX IF EXISTS "session_signed_in_idx";
DROP INDEX IF EXISTS "session_last_active_idx";

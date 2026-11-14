-- Rollback for 0390_data_request_erasure_hold. Roll the release back first: nothing may still
-- read or write the table. Held erasures waiting for a re-run are no longer re-run; staff see the
-- holds on each request's record page as before and erase again by hand.
-- Also removes this migration's ledger row so a later deploy reapplies it.
BEGIN;

SET LOCAL lock_timeout = '5s';
DROP TABLE IF EXISTS "data_request_erasure_hold";

DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1811851200000;

COMMIT;

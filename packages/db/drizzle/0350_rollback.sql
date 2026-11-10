-- Rollback for 0350_email_outbox_stray_snapshot_index. Only removes the index; the purge still
-- works without it, more slowly.
BEGIN;

SET LOCAL lock_timeout = '5s';

DROP INDEX IF EXISTS "email_outbox_stray_snapshot_idx";

COMMIT;

-- Rollback for 0403_notification_outbox_retry_backoff. Roll the release back first: the previous
-- release neither reads nor writes last_attempt_at, and retries a failed row on its next drain as
-- before 0403. Dropping the column only forgets when failed rows were last tried. Also removes this
-- migration's ledger row so a later deploy reapplies it.
BEGIN;

SET LOCAL lock_timeout = '30s';

ALTER TABLE "notification_outbox" DROP COLUMN IF EXISTS "last_attempt_at";

DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1813060800000;

COMMIT;

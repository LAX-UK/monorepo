-- Rollback for 0349_email_outbox_recipient_hash_index. Only removes the index; nothing reads it
-- by name.
BEGIN;

SET LOCAL lock_timeout = '5s';

DROP INDEX IF EXISTS "email_outbox_to_email_hash_idx";

COMMIT;

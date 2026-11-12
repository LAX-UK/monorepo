-- Rollback for 0356_session_device_marker. Roll back the application release first: the previous
-- release neither reads nor writes these columns or the lineage table. Rolling back forgets which
-- browser each record belongs to and which earlier ids a record stands for; people stay signed in,
-- and a product that held an earlier id then signs in again at its next renewal.
SET LOCAL lock_timeout = '5s';

DROP TABLE IF EXISTS "session_lineage";
DROP INDEX IF EXISTS "session_device_hash_user_idx";
ALTER TABLE "session" DROP COLUMN IF EXISTS "country";
ALTER TABLE "session" DROP COLUMN IF EXISTS "last_seen_at";
ALTER TABLE "session" DROP COLUMN IF EXISTS "signed_in_at";
ALTER TABLE "session" DROP COLUMN IF EXISTS "device_hash";

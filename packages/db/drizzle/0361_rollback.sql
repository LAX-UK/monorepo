-- Rollback for 0361_oauth_token_sign_in. Roll back the application release first: the previous
-- release neither reads nor writes the column. Rolling back forgets which sign-in each token was
-- issued under; tokens keep working, and signing out ends only the record again (the previous
-- release deletes all of a person's tokens at sign-out).
SET LOCAL lock_timeout = '5s';

DROP INDEX IF EXISTS "session_expires_at_id_idx";
DROP INDEX IF EXISTS "oauth_access_token_user_sid_idx";
ALTER TABLE "oauth_access_token" DROP COLUMN IF EXISTS "sid";

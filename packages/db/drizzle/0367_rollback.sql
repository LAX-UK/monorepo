-- Rollback for 0367_xero_token_sealing. Roll back the application release first: the previous
-- release reads and writes the plaintext columns only. Sealed tokens cannot be restored to
-- plaintext without the key, so a connection with no plaintext token is kept but marked
-- needs_reauth with empty tokens; an admin reconnects Xero to issue fresh ones.
SET LOCAL lock_timeout = '30s';

UPDATE "xero_connection"
   SET "access_token" = COALESCE("access_token", ''),
       "refresh_token" = COALESCE("refresh_token", ''),
       "connection_status" = 'needs_reauth'
 WHERE "access_token" IS NULL OR "refresh_token" IS NULL;

ALTER TABLE "xero_connection" ALTER COLUMN "access_token" SET NOT NULL;
ALTER TABLE "xero_connection" ALTER COLUMN "refresh_token" SET NOT NULL;
ALTER TABLE "xero_connection" DROP COLUMN IF EXISTS "access_token_sealed";
ALTER TABLE "xero_connection" DROP COLUMN IF EXISTS "refresh_token_sealed";

-- Rollback for 0324_legal_entity_client_message. The message is lost; screens fall back to
-- their standard wording.
BEGIN;

SET LOCAL lock_timeout = '5s';
ALTER TABLE "legal_entity" DROP COLUMN IF EXISTS "client_message";

COMMIT;

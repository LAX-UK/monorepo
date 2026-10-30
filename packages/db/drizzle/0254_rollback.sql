-- Rollback for 0254_notification_account. Roll back the application release first: the previous
-- release neither writes nor reads a notification's account. Accounts on notifications and
-- organisation mutes are lost; every notification shows in one inbox as before.
SET LOCAL lock_timeout = '30s';

DROP TABLE IF EXISTS "notification_account_mute";

DROP INDEX IF EXISTS "notification_user_id_legal_entity_id_created_at_idx";

ALTER TABLE "notification" DROP CONSTRAINT IF EXISTS "notification_legal_entity_id_legal_entity_id_fk";

ALTER TABLE "notification" DROP COLUMN IF EXISTS "legal_entity_id";

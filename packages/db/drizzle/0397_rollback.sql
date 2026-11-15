-- Rollback for 0397_enquiry_inbound_replies. Turn ENQUIRY_INBOUND_REPLIES_ENABLED off and roll the
-- application release back first: the earlier release does not read these columns. Customer
-- replies stored as inbound messages and every quarantined message are lost; staff replies
-- (direction 'outbound') are untouched. Removes this migration's ledger row so a later deploy
-- reapplies it.
BEGIN;

SET LOCAL lock_timeout = '30s';
DROP TABLE IF EXISTS "enquiry_inbound_quarantine";
DELETE FROM "marketing_enquiry_message" WHERE "direction" = 'inbound';
DROP INDEX IF EXISTS "marketing_enquiry_message_provider_uidx";
DROP INDEX IF EXISTS "marketing_enquiry_message_outbox_idx";
ALTER TABLE "marketing_enquiry_message"
  DROP CONSTRAINT IF EXISTS "marketing_enquiry_message_inbound_check",
  DROP CONSTRAINT IF EXISTS "marketing_enquiry_message_direction_check",
  DROP COLUMN IF EXISTS "attachments",
  DROP COLUMN IF EXISTS "matched_by",
  DROP COLUMN IF EXISTS "from_email_hash",
  DROP COLUMN IF EXISTS "provider_message_id",
  DROP COLUMN IF EXISTS "direction";
DROP INDEX IF EXISTS "marketing_enquiry_awaiting_reply_idx";
ALTER TABLE "marketing_enquiry" DROP COLUMN IF EXISTS "awaiting_reply_since";

DELETE FROM drizzle."__drizzle_migrations"
 WHERE "created_at" = 1812542400000;

COMMIT;

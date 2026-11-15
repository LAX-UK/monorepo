-- Rollback for 0398_enquiry_inbound_review. Turn ENQUIRY_INBOUND_REPLIES_ENABLED off and roll the
-- application release back first. Messages staff attached from quarantine leave their threads and
-- their quarantine rows return to pending (the held copy still has the text). Mail held as
-- 'unauthenticated' is relabelled 'spf_failed', the nearest earlier reason. The authentication
-- results are dropped. Removes this migration's ledger row so a later deploy reapplies it.
BEGIN;

SET LOCAL lock_timeout = '30s';
DELETE FROM "marketing_enquiry_message"
 WHERE "direction" = 'inbound' AND "matched_by" = 'staff';
UPDATE "enquiry_inbound_quarantine"
   SET "status" = 'pending', "reviewed_at" = NULL, "reviewed_by_user_id" = NULL
 WHERE "status" = 'linked';
UPDATE "enquiry_inbound_quarantine" SET "reason" = 'spf_failed' WHERE "reason" = 'unauthenticated';
ALTER TABLE "enquiry_inbound_quarantine"
  DROP CONSTRAINT IF EXISTS "enquiry_inbound_quarantine_dkim_result_check",
  DROP CONSTRAINT IF EXISTS "enquiry_inbound_quarantine_spf_result_check",
  DROP CONSTRAINT IF EXISTS "enquiry_inbound_quarantine_reason_check",
  ADD CONSTRAINT "enquiry_inbound_quarantine_reason_check"
    CHECK ("reason" IN ('unmatched', 'bad_token', 'sender_mismatch', 'spf_failed', 'auto_reply')),
  DROP COLUMN IF EXISTS "dkim_result",
  DROP COLUMN IF EXISTS "spf_result";
ALTER TABLE "marketing_enquiry_message"
  DROP CONSTRAINT IF EXISTS "marketing_enquiry_message_dkim_result_check",
  DROP CONSTRAINT IF EXISTS "marketing_enquiry_message_spf_result_check",
  DROP CONSTRAINT IF EXISTS "marketing_enquiry_message_inbound_check",
  ADD CONSTRAINT "marketing_enquiry_message_inbound_check"
    CHECK ("direction" = 'outbound' OR ("provider_message_id" IS NOT NULL
      AND "matched_by" IN ('token', 'in_reply_to')
      AND char_length("body") <= 20000 AND char_length("subject") <= 300
      AND jsonb_typeof("attachments") = 'array')),
  DROP COLUMN IF EXISTS "dkim_result",
  DROP COLUMN IF EXISTS "spf_result";

DELETE FROM drizzle."__drizzle_migrations"
 WHERE "created_at" = 1812628800000;

COMMIT;

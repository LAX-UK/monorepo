-- Enquiry replies by email, staff side (BA-10 / PS-4, part B). Nothing here changes behaviour on
-- its own: the inbound webhook stays off until ENQUIRY_INBOUND_REPLIES_ENABLED is set.
--
-- 1. The sender authentication result of each received mail is kept on its row: the SPF result
--    the receiving server recorded, and whether a DKIM signature passed for a domain aligned with
--    the From address. A reply is only filed on a thread on its own when SPF passed or an aligned
--    DKIM signature passed; anything else is held as 'unauthenticated'.
-- 2. Staff may attach a held message to an enquiry. The message then joins the thread with
--    matched_by 'staff', keeps why it was held and the reason the person gave, and the attach is
--    audited with the person who did it.
-- 3. An SPF pass counts only for a domain aligned with the From address; a pass for another
--    domain is recorded as 'pass_unaligned'.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "marketing_enquiry_message"
  ADD COLUMN IF NOT EXISTS "spf_result" text,
  ADD COLUMN IF NOT EXISTS "dkim_result" text,
  ADD COLUMN IF NOT EXISTS "held_reason" text,
  ADD COLUMN IF NOT EXISTS "review_reason" text;
--> statement-breakpoint
ALTER TABLE "marketing_enquiry_message"
  DROP CONSTRAINT IF EXISTS "marketing_enquiry_message_inbound_check",
  ADD CONSTRAINT "marketing_enquiry_message_inbound_check"
    CHECK ("direction" = 'outbound' OR ("provider_message_id" IS NOT NULL
      AND "matched_by" IN ('token', 'in_reply_to', 'staff')
      AND char_length("body") <= 20000 AND char_length("subject") <= 300
      AND jsonb_typeof("attachments") = 'array')),
  ADD CONSTRAINT "marketing_enquiry_message_spf_result_check"
    CHECK ("spf_result" IS NULL OR "spf_result" IN
      ('pass', 'pass_unaligned', 'fail', 'softfail', 'neutral', 'none', 'temperror',
        'permerror')),
  ADD CONSTRAINT "marketing_enquiry_message_dkim_result_check"
    CHECK ("dkim_result" IS NULL OR "dkim_result" IN ('pass', 'pass_unaligned', 'fail', 'none')),
  ADD CONSTRAINT "marketing_enquiry_message_held_reason_check"
    CHECK ("held_reason" IS NULL OR ("matched_by" = 'staff' AND "held_reason" IN ('unmatched',
      'bad_token', 'sender_mismatch', 'spf_failed', 'auto_reply', 'unauthenticated'))),
  ADD CONSTRAINT "marketing_enquiry_message_review_reason_check"
    CHECK ("review_reason" IS NULL OR ("matched_by" = 'staff'
      AND char_length("review_reason") <= 500));
--> statement-breakpoint
ALTER TABLE "enquiry_inbound_quarantine"
  ADD COLUMN IF NOT EXISTS "spf_result" text,
  ADD COLUMN IF NOT EXISTS "dkim_result" text;
--> statement-breakpoint
ALTER TABLE "enquiry_inbound_quarantine"
  DROP CONSTRAINT IF EXISTS "enquiry_inbound_quarantine_reason_check",
  ADD CONSTRAINT "enquiry_inbound_quarantine_reason_check"
    CHECK ("reason" IN ('unmatched', 'bad_token', 'sender_mismatch', 'spf_failed', 'auto_reply',
      'unauthenticated')),
  ADD CONSTRAINT "enquiry_inbound_quarantine_spf_result_check"
    CHECK ("spf_result" IS NULL OR "spf_result" IN
      ('pass', 'pass_unaligned', 'fail', 'softfail', 'neutral', 'none', 'temperror',
        'permerror')),
  ADD CONSTRAINT "enquiry_inbound_quarantine_dkim_result_check"
    CHECK ("dkim_result" IS NULL OR "dkim_result" IN ('pass', 'pass_unaligned', 'fail', 'none'));

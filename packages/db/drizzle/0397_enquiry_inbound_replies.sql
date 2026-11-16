-- Enquiry replies by email, receiving side (BA-10 / PS-4, PR A). Nothing here changes behaviour on
-- its own: the inbound webhook is off until ENQUIRY_INBOUND_REPLIES_ENABLED is set. Numbered after
-- the open 0395 and 0396; it may be renumbered at ship time.
--
-- 1. marketing_enquiry_message holds both directions of a thread. Staff replies (outbound) are
--    unchanged; a sender's emailed reply (inbound) carries Postmark's MessageID (unique, so a
--    replayed delivery is the same row), a hash of the From address, how it was matched to the
--    thread, and the metadata of its attachments (no file is stored).
-- 2. marketing_enquiry.awaiting_reply_since marks a thread whose latest customer reply nobody has
--    answered.
-- 3. enquiry_inbound_quarantine holds inbound mail that could not be tied to a thread with
--    confidence. It is never attached to a thread, kept 30 days, and reviewed by staff.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "marketing_enquiry_message"
  ADD COLUMN IF NOT EXISTS "direction" text DEFAULT 'outbound' NOT NULL,
  ADD COLUMN IF NOT EXISTS "provider_message_id" text,
  ADD COLUMN IF NOT EXISTS "from_email_hash" text,
  ADD COLUMN IF NOT EXISTS "matched_by" text,
  ADD COLUMN IF NOT EXISTS "attachments" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "marketing_enquiry_message"
  ADD CONSTRAINT "marketing_enquiry_message_direction_check"
    CHECK ("direction" IN ('outbound', 'inbound')),
  ADD CONSTRAINT "marketing_enquiry_message_inbound_check"
    CHECK ("direction" = 'outbound' OR ("provider_message_id" IS NOT NULL
      AND "matched_by" IN ('token', 'in_reply_to')
      AND char_length("body") <= 20000 AND char_length("subject") <= 300
      AND jsonb_typeof("attachments") = 'array'));
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "marketing_enquiry_message_provider_uidx"
  ON "marketing_enquiry_message" ("provider_message_id") WHERE "provider_message_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketing_enquiry_message_outbox_idx"
  ON "marketing_enquiry_message" ("outbox_id") WHERE "outbox_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "marketing_enquiry" ADD COLUMN IF NOT EXISTS "awaiting_reply_since" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketing_enquiry_awaiting_reply_idx"
  ON "marketing_enquiry" ("awaiting_reply_since") WHERE "awaiting_reply_since" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enquiry_inbound_quarantine" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider_message_id" text NOT NULL,
  "reason" text NOT NULL,
  "from_address" text NOT NULL,
  "subject" text NOT NULL,
  "body" text NOT NULL,
  "attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "suspected_enquiry_id" uuid,
  "status" text DEFAULT 'pending' NOT NULL,
  "reviewed_by_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "reviewed_at" timestamp with time zone,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL,
  "purge_at" timestamp with time zone DEFAULT now() + interval '30 days' NOT NULL,
  CONSTRAINT "enquiry_inbound_quarantine_reason_check"
    CHECK ("reason" IN ('unmatched', 'bad_token', 'sender_mismatch', 'spf_failed', 'auto_reply')),
  CONSTRAINT "enquiry_inbound_quarantine_status_check"
    CHECK ("status" IN ('pending', 'dismissed', 'linked')),
  CONSTRAINT "enquiry_inbound_quarantine_reviewed_check"
    CHECK (("status" = 'pending') = ("reviewed_at" IS NULL)),
  CONSTRAINT "enquiry_inbound_quarantine_size_check"
    CHECK (char_length("body") <= 20000 AND char_length("subject") <= 300
      AND char_length("from_address") <= 320)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enquiry_inbound_quarantine_provider_uidx"
  ON "enquiry_inbound_quarantine" ("provider_message_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enquiry_inbound_quarantine_pending_idx"
  ON "enquiry_inbound_quarantine" ("received_at") WHERE "status" = 'pending';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enquiry_inbound_quarantine_purge_idx"
  ON "enquiry_inbound_quarantine" ("purge_at");

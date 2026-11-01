-- Consignment messages: one thread per consignment between the account's people and LAX's
-- specialists, with photos and PDFs attached from checked uploads. A specialist's reply is a new
-- notice for the account, and an unread one waits on Needs you.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "consignment_thread" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "submission_id" uuid NOT NULL,
  "last_message_at" timestamp with time zone NOT NULL,
  "last_message_side" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "consignment_thread_last_side_check"
    CHECK ("last_message_side" IN ('client', 'staff')),
  CONSTRAINT "consignment_thread_submission_id_item_submission_id_fk"
    FOREIGN KEY ("submission_id") REFERENCES "public"."item_submission"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "consignment_thread_submission_uidx"
  ON "consignment_thread" ("submission_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consignment_thread_inbox_idx"
  ON "consignment_thread" ("last_message_side", "last_message_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "consignment_message" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "thread_id" uuid NOT NULL,
  "author_user_id" text,
  "author_side" text NOT NULL,
  "body" text DEFAULT '' NOT NULL,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "consignment_message_side_check" CHECK ("author_side" IN ('client', 'staff')),
  CONSTRAINT "consignment_message_body_length_check" CHECK (char_length("body") <= 4000),
  CONSTRAINT "consignment_message_thread_id_consignment_thread_id_fk"
    FOREIGN KEY ("thread_id") REFERENCES "public"."consignment_thread"("id") ON DELETE cascade,
  CONSTRAINT "consignment_message_author_user_id_user_id_fk"
    FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consignment_message_thread_created_idx"
  ON "consignment_message" ("thread_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consignment_message_unread_idx"
  ON "consignment_message" ("thread_id", "author_side")
  WHERE "read_at" IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "consignment_message_attachment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "message_id" uuid NOT NULL,
  "upload_object_id" uuid NOT NULL,
  "file_name" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "consignment_message_attachment_message_id_consignment_message_id_fk"
    FOREIGN KEY ("message_id") REFERENCES "public"."consignment_message"("id") ON DELETE cascade,
  CONSTRAINT "consignment_message_attachment_upload_object_id_upload_object_id_fk"
    FOREIGN KEY ("upload_object_id") REFERENCES "public"."upload_object"("id") ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consignment_message_attachment_message_idx"
  ON "consignment_message_attachment" ("message_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "consignment_message_attachment_upload_uidx"
  ON "consignment_message_attachment" ("upload_object_id");
--> statement-breakpoint
ALTER TABLE notification DROP CONSTRAINT IF EXISTS notification_type_check;
--> statement-breakpoint
ALTER TABLE notification
  ADD CONSTRAINT notification_type_check CHECK (
    type IN (
      'outbid',
      'lot_cancelled',
      'lot_won',
      'lot_lost',
      'lot_ending_soon',
      'watchlist_starting',
      'watchlist_ending_soon',
      'payment_received',
      'payment_due',
      'lot_ended_seller',
      'kyc_resubmission_required',
      'submission_received_for_review',
      'submission_approved',
      'submission_rejected',
      'submission_converted',
      'submission_draft_reminder',
      'submission_changes_requested',
      'consignment_agreement_reminder',
      'consignment_update',
      'condition_report_ready',
      'condition_report_declined',
      'source_of_funds_documents_requested',
      'source_of_funds_approved',
      'source_of_funds_rejected',
      'staff_role_expired',
      'staff_role_expired_admin',
      'staff_role_changed',
      'staff_role_changed_admin',
      'lot_ready_for_collection',
      'lot_shipped',
      'lot_delivered',
      'organisation_member_left',
      'payout_bank_changed',
      'delivery_quote_ready',
      'payout_problem',
      'bid_refused_limit',
      'access_requested',
      'access_request_decided',
      'consignment_message'
    )
  );

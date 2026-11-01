-- Reminders on watched lots: when (as the sale starts, a day or an hour before the lot closes)
-- and an optional note, one per watched lot and removed with it. A worker job sends each one
-- once through the notification dispatcher; `sent_at` records that (or that it was dropped
-- because its moment passed). A new notice type, `watchlist_reminder`, follows the person's
-- "Lots you watch" switches for the app and email.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "watchlist_reminder" (
  "watchlist_id" uuid PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "lot_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "note" text,
  "sent_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "watchlist_reminder_kind_check"
    CHECK ("kind" IN ('sale_start', 'day_before_close', 'hour_before_close')),
  CONSTRAINT "watchlist_reminder_note_length" CHECK (char_length("note") <= 500),
  CONSTRAINT "watchlist_reminder_watchlist_id_watchlist_id_fk"
    FOREIGN KEY ("watchlist_id") REFERENCES "public"."watchlist"("id") ON DELETE cascade,
  CONSTRAINT "watchlist_reminder_user_id_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade,
  CONSTRAINT "watchlist_reminder_lot_id_lot_id_fk"
    FOREIGN KEY ("lot_id") REFERENCES "public"."lot"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "watchlist_reminder_user_idx" ON "watchlist_reminder" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "watchlist_reminder_pending_idx"
  ON "watchlist_reminder" ("lot_id") WHERE "sent_at" IS NULL;
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
      'consignment_message',
      'watchlist_reminder'
    )
  );

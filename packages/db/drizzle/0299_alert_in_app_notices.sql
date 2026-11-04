-- In-app notices for LAX Bid followed-artist and saved-search alerts.
--   notification gains the artist_lots_listed and search_lots_listed types, a link_path (the site
--     page the notice opens) and alert_digest_id (the daily digest the notice was written for).
--     A digest has at most one notice per type, so assembling a digest again adds nothing.
--   notification_preference gains artist_alerts_in_app and search_alerts_in_app, on by default.
-- Additive: the running release keeps working until it restarts.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN IF NOT EXISTS "link_path" text;
--> statement-breakpoint
ALTER TABLE "notification"
  ADD COLUMN IF NOT EXISTS "alert_digest_id" uuid REFERENCES "bid_alert_digest"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "notification" DROP CONSTRAINT IF EXISTS "notification_link_path_check";
--> statement-breakpoint
ALTER TABLE "notification"
  ADD CONSTRAINT "notification_link_path_check" CHECK (
    "link_path" IS NULL OR ("link_path" LIKE '/%' AND "link_path" NOT LIKE '//%' AND char_length("link_path") <= 500)
  );
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notification_alert_digest_type_uid"
  ON "notification" ("alert_digest_id", "type") WHERE "alert_digest_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "notification_preference"
  ADD COLUMN IF NOT EXISTS "artist_alerts_in_app" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "notification_preference"
  ADD COLUMN IF NOT EXISTS "search_alerts_in_app" boolean DEFAULT true NOT NULL;
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
      'watchlist_reminder',
      'kyc_approved',
      'kyc_declined',
      'sale_cancelled',
      'payment_reminder',
      'buyer_default_notice',
      'sale_announced',
      'artist_lots_listed',
      'search_lots_listed'
    )
  );
--> statement-breakpoint
-- Lot matching starts here: lots published before this migration are never announced, and every
-- lot published after it is, however long the worker takes to get to it.
INSERT INTO "projector_state" ("projector_name", "last_processed_event_id")
SELECT 'bid_alert_lot_matching_start', COALESCE(max("id"), 0) FROM "domain_events"
ON CONFLICT ("projector_name") DO NOTHING;
--> statement-breakpoint
-- A lot reaches a person once, whichever topic matched it, even across batches and runs.
CREATE UNIQUE INDEX IF NOT EXISTS "bid_alert_match_lot_once_uid"
  ON "bid_alert_match" ("subscriber_id", "item_key") WHERE "item_key" LIKE 'lot:%';

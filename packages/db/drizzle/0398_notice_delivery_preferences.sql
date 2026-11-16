-- Notice delivery preferences for identity checks, and in-app notices for registrations to bid.
--   notification_preference gains identity_in_app and identity_email (the result of an identity
--     check) and registration_in_app (a decision on a request to bid, and a change to its limit),
--     all on by default, so nobody's delivery changes until they choose.
--   notification gains the sale_registration_decided and bidding_limit_changed types: the emails
--     for both already exist, and each now has its notice in the app.
-- Additive: the running release keeps working until it restarts.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "notification_preference"
  ADD COLUMN IF NOT EXISTS "identity_in_app" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "notification_preference"
  ADD COLUMN IF NOT EXISTS "identity_email" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "notification_preference"
  ADD COLUMN IF NOT EXISTS "registration_in_app" boolean DEFAULT true NOT NULL;
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
      'search_lots_listed',
      'reoffer_seller_request',
      'reoffer_seller_reminder',
      'reoffer_seller_outcome',
      'reoffer_offer',
      'reoffer_offer_reminder',
      'reoffer_offer_closed',
      'collection_booked',
      'collection_changed',
      'collection_cancelled',
      'collection_reminder',
      'sale_registration_decided',
      'bidding_limit_changed'
    )
  );

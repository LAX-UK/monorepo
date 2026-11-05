-- Rollback for 0299_alert_in_app_notices. Roll back the application release first: the previous
-- release neither writes nor reads these notices. Artist and saved-search notices are deleted,
-- since the previous constraint does not allow their types; the two preference columns and the
-- notice link and digest columns are dropped.
SET LOCAL lock_timeout = '30s';

DELETE FROM notification WHERE type IN ('artist_lots_listed', 'search_lots_listed');

DROP INDEX IF EXISTS "notification_alert_digest_type_uid";
ALTER TABLE "notification" DROP CONSTRAINT IF EXISTS "notification_link_path_check";
ALTER TABLE "notification" DROP COLUMN IF EXISTS "alert_digest_id";
ALTER TABLE "notification" DROP COLUMN IF EXISTS "link_path";
ALTER TABLE "notification_preference" DROP COLUMN IF EXISTS "artist_alerts_in_app";
ALTER TABLE "notification_preference" DROP COLUMN IF EXISTS "search_alerts_in_app";

ALTER TABLE notification DROP CONSTRAINT IF EXISTS notification_type_check;

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
      'sale_announced'
    )
  );

DROP INDEX IF EXISTS "bid_alert_match_lot_once_uid";
DELETE FROM "projector_state" WHERE "projector_name" = 'bid_alert_lot_matching_start';

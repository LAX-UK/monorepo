-- Rollback for 0354_lot_reoffer. Roll back the application release first: the previous release
-- neither reads nor writes these tables. Every re-offer and every recorded seller answer is lost.
-- No lot is changed by this rollback, so a lot already re-awarded keeps its new buyer. Re-offer
-- notices already delivered are deleted, since the previous constraint does not allow their types.
-- The constraint is restored to the 0299 list.
SET LOCAL lock_timeout = '30s';

DROP TABLE IF EXISTS "lot_reoffer";
DROP TABLE IF EXISTS "seller_consent";

DELETE FROM notification WHERE type IN (
  'reoffer_seller_request',
  'reoffer_seller_reminder',
  'reoffer_seller_outcome',
  'reoffer_offer',
  'reoffer_offer_reminder',
  'reoffer_offer_closed'
);

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
      'sale_announced',
      'artist_lots_listed',
      'search_lots_listed'
    )
  );

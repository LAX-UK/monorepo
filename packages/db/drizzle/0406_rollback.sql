-- Rollback for 0406_delivery_quote_decline. Roll the release back first: the previous release
-- neither declines quotes nor writes delivery_quote_declined notices. Declined quotes stay
-- withdrawn (the buyer may still ask again); only the reason the team gave is forgotten, which the
-- buyer already has in their email. Declined notices already delivered are deleted, since the
-- previous constraint does not allow their type; their emails are not affected. The constraint is
-- restored to the 0402 list. Also removes this migration's ledger row so a later deploy reapplies it.
BEGIN;

SET LOCAL lock_timeout = '30s';

DELETE FROM notification WHERE type = 'delivery_quote_declined';

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
  ) NOT VALID;

ALTER TABLE "delivery_quote" DROP CONSTRAINT IF EXISTS "delivery_quote_decline_reason_check";

ALTER TABLE "delivery_quote" DROP COLUMN IF EXISTS "decline_reason";

DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1813320000000;

COMMIT;

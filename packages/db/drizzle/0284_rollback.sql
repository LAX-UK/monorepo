-- Rollback for 0284_alert_engine. Roll back the application release first: the previous release
-- neither reads nor writes these tables, and sends no alert emails. Subscribers, their topic
-- switches, matches, digests and announcements are lost. Addresses that signed up before the
-- engine are still in visitor_sale_alert_subscriber as they were at the move; changes made
-- after it (a new sign-up, a confirmation, a stop) are not copied back, so replay them from
-- bid_alert_subscriber first if any matter. Sale announcement notices are deleted, since the
-- previous constraint does not allow their type.
SET LOCAL lock_timeout = '30s';

DROP TABLE IF EXISTS "bid_alert_match";
DROP TABLE IF EXISTS "bid_alert_digest";
DROP TABLE IF EXISTS "bid_alert_topic";
DROP TABLE IF EXISTS "bid_alert_announcement";
DROP TABLE IF EXISTS "bid_alert_subscriber";

DELETE FROM notification WHERE type = 'sale_announced';

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
      'buyer_default_notice'
    )
  );

ALTER TABLE notification DROP COLUMN IF EXISTS sale_id;
ALTER TABLE notification_preference DROP COLUMN IF EXISTS new_sales_in_app;

-- Three new notice types: identity check approved and declined, and a whole sale cancelled.
-- Each is sent once per person, in the app and by email.
SET LOCAL lock_timeout = '30s';
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
      'sale_cancelled'
    )
  );

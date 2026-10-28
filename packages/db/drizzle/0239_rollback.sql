-- Drops unsold-lot choices (requests and specialist confirmations), the relist reserve floor
-- and the identity reminder mark, so roll back the application release first.
DELETE FROM notification WHERE type = 'consignment_update';

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
      'condition_report_ready',
      'condition_report_declined',
      'source_of_funds_documents_requested',
      'source_of_funds_approved',
      'source_of_funds_rejected'
    )
  );

ALTER TABLE "item_submission" DROP COLUMN IF EXISTS "identity_reminder_sent_at";

ALTER TABLE "consignment_agreement" DROP COLUMN IF EXISTS "relist_reserve_floor";

DROP TABLE IF EXISTS "unsold_lot_choice";

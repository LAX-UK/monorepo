ALTER TABLE "notification" DROP CONSTRAINT IF EXISTS "notification_type_check";
ALTER TABLE "notification" ADD CONSTRAINT "notification_type_check" CHECK (
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
    'submission_draft_reminder',
    'condition_report_ready',
    'condition_report_declined'
  )
);

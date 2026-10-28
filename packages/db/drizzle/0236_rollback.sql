-- Drops consignment agreements (with every recorded acceptance) and the "needs changes" note,
-- so roll back the application release first. PostgreSQL cannot drop the 'changes_requested'
-- label from item_submission_status; those submissions return to review instead.
DELETE FROM notification WHERE type IN ('submission_changes_requested', 'consignment_agreement_reminder');

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
      'condition_report_ready',
      'condition_report_declined',
      'source_of_funds_documents_requested',
      'source_of_funds_approved',
      'source_of_funds_rejected'
    )
  );

DROP TABLE IF EXISTS "consignment_agreement";

UPDATE "item_submission" SET "status" = 'under_review' WHERE "status" = 'changes_requested';

ALTER TABLE "item_submission" DROP COLUMN IF EXISTS "changes_requested_at";

ALTER TABLE "item_submission" DROP COLUMN IF EXISTS "changes_requested_note";

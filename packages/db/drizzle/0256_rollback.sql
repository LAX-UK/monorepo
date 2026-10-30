-- Rollback for 0256_organisation_invoice_details. Roll back the application release first: the
-- previous release neither reads nor writes invoice details. Saved details are lost; invoices go
-- back to the organisation's registered billing address with no PO reference. Member-left and
-- bank-change notices are deleted, since the previous constraint does not allow them.
SET LOCAL lock_timeout = '30s';

DROP TABLE IF EXISTS "legal_entity_invoice_details";

DELETE FROM notification WHERE type IN ('organisation_member_left', 'payout_bank_changed');

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
      'lot_delivered'
    )
  );

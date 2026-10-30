-- Rollback for 0257_workspace_buying_modules. Roll back the application release first: the
-- previous release neither reads nor writes these. Delivery quotes, artist alert criteria and the
-- three new notices are lost; following an artist and every other notice are unchanged.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
DELETE FROM notification WHERE type IN ('delivery_quote_ready', 'payout_problem', 'bid_refused_limit');
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
      'payout_bank_changed'
    )
  );
--> statement-breakpoint
ALTER TABLE "artist_watchlist" DROP CONSTRAINT IF EXISTS "artist_watchlist_alert_price_range_check";
--> statement-breakpoint
ALTER TABLE "artist_watchlist" DROP COLUMN IF EXISTS "alert_updated_at";
--> statement-breakpoint
ALTER TABLE "artist_watchlist" DROP COLUMN IF EXISTS "alert_price_max";
--> statement-breakpoint
ALTER TABLE "artist_watchlist" DROP COLUMN IF EXISTS "alert_price_min";
--> statement-breakpoint
ALTER TABLE "artist_watchlist" DROP COLUMN IF EXISTS "alert_medium";
--> statement-breakpoint
DROP TABLE IF EXISTS "delivery_quote";

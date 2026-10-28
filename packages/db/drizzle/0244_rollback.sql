-- Puts back one grant per platform on each invitation and the notification types from before
-- staff role expiry, and forgets which ends were recorded. Roll back the application release
-- first. An invitation keeps its primary Bid role (the one on user_invitation); any other Bid
-- roles it carried are lost.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
DELETE FROM notification WHERE type IN ('staff_role_expired', 'staff_role_expired_admin');
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
      'source_of_funds_rejected'
    )
  );
--> statement-breakpoint
DELETE FROM "user_invitation_product_grant" g
USING "user_invitation" i
WHERE g."invitation_id" = i."id"
  AND g."product" = 'bid'
  AND i."target_staff_role" IS NOT NULL
  AND g."role" <> i."target_staff_role"::text;
--> statement-breakpoint
DELETE FROM "user_invitation_product_grant" g
WHERE EXISTS (
  SELECT 1 FROM "user_invitation_product_grant" other
  WHERE other."invitation_id" = g."invitation_id"
    AND other."product" = g."product"
    AND other."role" < g."role"
);
--> statement-breakpoint
ALTER TABLE "user_invitation_product_grant" DROP CONSTRAINT IF EXISTS "user_invitation_product_grant_pk";
--> statement-breakpoint
ALTER TABLE "user_invitation_product_grant" ADD CONSTRAINT "user_invitation_product_grant_pk" PRIMARY KEY ("invitation_id", "product");
--> statement-breakpoint
DROP INDEX IF EXISTS "staff_role_assignment_unrecorded_end_idx";
--> statement-breakpoint
ALTER TABLE "staff_role_assignment" DROP COLUMN IF EXISTS "end_recorded_at";

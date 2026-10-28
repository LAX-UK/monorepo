-- Staff role screens: an assignment's end is recorded once (at removal, or by the daily expiry
-- job after its end date), invitations may carry several Bid roles, and staff are told in the
-- product when a role ends.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "staff_role_assignment" ADD COLUMN IF NOT EXISTS "end_recorded_at" timestamp with time zone;
--> statement-breakpoint
-- Ends already in the past were removals or expiries nobody needs telling about again.
UPDATE "staff_role_assignment"
SET "end_recorded_at" = "ends_at"
WHERE "ends_at" IS NOT NULL AND "ends_at" <= now() AND "end_recorded_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staff_role_assignment_unrecorded_end_idx" ON "staff_role_assignment" USING btree ("ends_at") WHERE "ends_at" IS NOT NULL AND "end_recorded_at" IS NULL;
--> statement-breakpoint
-- One row per role an invitation grants: several on Bid, still one on Shop (checked by the API).
ALTER TABLE "user_invitation_product_grant" DROP CONSTRAINT IF EXISTS "user_invitation_product_grant_pk";
--> statement-breakpoint
ALTER TABLE "user_invitation_product_grant" ADD CONSTRAINT "user_invitation_product_grant_pk" PRIMARY KEY ("invitation_id", "product", "role");
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
      'staff_role_expired_admin'
    )
  );

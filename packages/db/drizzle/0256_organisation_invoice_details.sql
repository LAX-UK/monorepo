-- Invoice details an organisation's finance team keeps for its Bid invoices: the billing email,
-- the address to print and an optional purchase-order reference. One row per organisation; with
-- no row, invoices keep using the organisation's registered billing address.
-- Two new notices: owners and admins hear when a member leaves, and owners, admins and finance
-- when the payout bank account changes.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "legal_entity_invoice_details" (
  "legal_entity_id" uuid PRIMARY KEY NOT NULL,
  "billing_email" text,
  "line1" text,
  "line2" text,
  "city" text,
  "region" text,
  "postal_code" text,
  "country" text,
  "po_reference" text,
  "updated_by_user_id" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "legal_entity_invoice_details_address_complete" CHECK (
    ("line1" IS NULL AND "city" IS NULL AND "postal_code" IS NULL AND "country" IS NULL)
    OR ("line1" IS NOT NULL AND "city" IS NOT NULL AND "postal_code" IS NOT NULL AND "country" IS NOT NULL)
  ),
  CONSTRAINT "legal_entity_invoice_details_legal_entity_id_legal_entity_id_fk"
    FOREIGN KEY ("legal_entity_id") REFERENCES "public"."legal_entity"("id") ON DELETE cascade,
  CONSTRAINT "legal_entity_invoice_details_updated_by_user_id_user_id_fk"
    FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null
);
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

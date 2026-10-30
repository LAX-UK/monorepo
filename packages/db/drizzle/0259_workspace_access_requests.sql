-- Ask for access: a member asks the owners and admins of an organisation for a role, or for one
-- thing their role can't do yet, with a reason. Owners and admins approve it by giving a role, or
-- decline it. Two notices join the inbox: a request waiting for a decision, and the decision.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "access_request" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "legal_entity_id" uuid NOT NULL,
  "requester_user_id" text NOT NULL,
  "requested_role" text,
  "requested_capability" text,
  "reason" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "granted_role" text,
  "decided_by_user_id" text,
  "decided_at" timestamp with time zone,
  "decision_note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "access_request_status_check"
    CHECK ("status" IN ('pending', 'approved', 'declined', 'withdrawn')),
  CONSTRAINT "access_request_ask_check"
    CHECK (("requested_role" IS NULL) <> ("requested_capability" IS NULL)),
  CONSTRAINT "access_request_legal_entity_id_legal_entity_id_fk"
    FOREIGN KEY ("legal_entity_id") REFERENCES "public"."legal_entity"("id") ON DELETE cascade,
  CONSTRAINT "access_request_requester_user_id_user_id_fk"
    FOREIGN KEY ("requester_user_id") REFERENCES "public"."user"("id") ON DELETE cascade,
  CONSTRAINT "access_request_decided_by_user_id_user_id_fk"
    FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "access_request_pending_uidx"
  ON "access_request" (
    "legal_entity_id",
    "requester_user_id",
    coalesce("requested_role", ''),
    coalesce("requested_capability", '')
  )
  WHERE "status" = 'pending';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "access_request_entity_status_idx"
  ON "access_request" ("legal_entity_id", "status");
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
      'access_request_decided'
    )
  );

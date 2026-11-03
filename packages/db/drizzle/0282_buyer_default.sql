-- Buyer default and payment reminders.
--   buyer_default: the record of a won lot whose buyer did not pay. The voided invoice stays in
--     `payment` (cancelled); this row keeps who voided it, why and where the lot went next, so
--     nothing is deleted and the buyer can still see what happened to the purchase.
--   payment_reminder: one row per invoice and reminder step, written before the reminder is
--     sent so a repeated run sends nothing twice.
-- Two new notice types, `payment_reminder` and `buyer_default_notice`, are allowed on
-- `notification`, alongside every type 0281 allowed. Additive: the running services keep working until they restart.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "buyer_default" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lot_id" uuid NOT NULL,
  "payment_id" uuid,
  "buyer_id" text NOT NULL,
  "buyer_legal_entity_id" uuid NOT NULL,
  "seller_legal_entity_id" uuid NOT NULL,
  "hammer_price" numeric(18, 2) NOT NULL,
  "won_at" timestamp with time zone NOT NULL,
  "reason" text NOT NULL,
  "outcome" text NOT NULL,
  "offered_user_id" text,
  "offered_amount" numeric(18, 2),
  "buyer_restricted" boolean DEFAULT false NOT NULL,
  "actor_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "buyer_default_outcome_check"
    CHECK ("outcome" IN ('returned_to_inventory', 'offered_to_underbidder')),
  CONSTRAINT "buyer_default_reason_length" CHECK (char_length("reason") BETWEEN 1 AND 1000),
  CONSTRAINT "buyer_default_lot_id_lot_id_fk"
    FOREIGN KEY ("lot_id") REFERENCES "public"."lot"("id") ON DELETE cascade,
  CONSTRAINT "buyer_default_payment_id_payment_id_fk"
    FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE set null,
  CONSTRAINT "buyer_default_buyer_id_user_id_fk"
    FOREIGN KEY ("buyer_id") REFERENCES "public"."user"("id") ON DELETE cascade,
  CONSTRAINT "buyer_default_buyer_legal_entity_id_legal_entity_id_fk"
    FOREIGN KEY ("buyer_legal_entity_id") REFERENCES "public"."legal_entity"("id") ON DELETE restrict,
  CONSTRAINT "buyer_default_seller_legal_entity_id_legal_entity_id_fk"
    FOREIGN KEY ("seller_legal_entity_id") REFERENCES "public"."legal_entity"("id") ON DELETE restrict,
  CONSTRAINT "buyer_default_offered_user_id_user_id_fk"
    FOREIGN KEY ("offered_user_id") REFERENCES "public"."user"("id") ON DELETE set null,
  CONSTRAINT "buyer_default_actor_user_id_user_id_fk"
    FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "buyer_default_lot_id_idx" ON "buyer_default" ("lot_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "buyer_default_buyer_entity_idx"
  ON "buyer_default" ("buyer_legal_entity_id", "created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "buyer_default_payment_uidx"
  ON "buyer_default" ("payment_id") WHERE "payment_id" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_reminder" (
  "payment_id" uuid NOT NULL,
  "step" text NOT NULL,
  "sent_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "payment_reminder_payment_id_step_pk" PRIMARY KEY ("payment_id", "step"),
  CONSTRAINT "payment_reminder_step_check"
    CHECK ("step" IN ('before_due', 'due_day', 'overdue')),
  CONSTRAINT "payment_reminder_payment_id_payment_id_fk"
    FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE cascade
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
      'sale_cancelled',
      'payment_reminder',
      'buyer_default_notice'
    )
  );

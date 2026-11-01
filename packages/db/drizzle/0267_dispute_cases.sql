-- Dispute cases: every card dispute Stripe reports on a Bid charge is recorded, with its respond-by
-- deadline and status, even when no payment matches the charge. A dispute on a charge that paid
-- several invoices is linked to each of them and waits for the finance team to allocate it;
-- allocation lines carry each invoice's share and record what was done to its seller's payout.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dispute_case" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "stripe_dispute_id" text NOT NULL,
  "stripe_charge_id" text NOT NULL,
  "stripe_payment_intent_id" text,
  "amount_pence" integer NOT NULL,
  "currency" text NOT NULL,
  "reason" text,
  "network_reason_code" text,
  "card_brand" text,
  "card_last4" text,
  "status" text NOT NULL,
  "due_by" timestamp with time zone,
  "evidence_submitted" boolean DEFAULT false NOT NULL,
  "charge_refundable" boolean,
  "allocation_state" text NOT NULL,
  "funds_withdrawn_at" timestamp with time zone,
  "funds_reinstated_at" timestamp with time zone,
  "stripe_created_at" timestamp with time zone NOT NULL,
  "last_event_at" timestamp with time zone NOT NULL,
  "closed_at" timestamp with time zone,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "dispute_case_allocation_state_check"
    CHECK ("allocation_state" IN ('allocated', 'needs_allocation')),
  CONSTRAINT "dispute_case_amount_check" CHECK ("amount_pence" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "dispute_case_stripe_dispute_id_uidx"
  ON "dispute_case" ("stripe_dispute_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dispute_case_stripe_charge_id_idx"
  ON "dispute_case" ("stripe_charge_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dispute_case_needs_allocation_idx"
  ON "dispute_case" ("status")
  WHERE "allocation_state" = 'needs_allocation';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dispute_case_candidate" (
  "case_id" uuid NOT NULL,
  "payment_id" uuid NOT NULL,
  CONSTRAINT "dispute_case_candidate_case_id_payment_id_pk" PRIMARY KEY ("case_id", "payment_id"),
  CONSTRAINT "dispute_case_candidate_case_id_dispute_case_id_fk"
    FOREIGN KEY ("case_id") REFERENCES "public"."dispute_case"("id") ON DELETE cascade,
  CONSTRAINT "dispute_case_candidate_payment_id_payment_id_fk"
    FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dispute_case_candidate_payment_id_idx"
  ON "dispute_case_candidate" ("payment_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dispute_allocation" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "case_id" uuid NOT NULL,
  "payment_id" uuid NOT NULL,
  "seller_legal_entity_id" uuid NOT NULL,
  "amount_pence" integer NOT NULL,
  "seller_share_pence" integer NOT NULL,
  "clawback" text DEFAULT 'none' NOT NULL,
  "source" text NOT NULL,
  "allocated_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "dispute_allocation_amount_check" CHECK ("amount_pence" > 0),
  CONSTRAINT "dispute_allocation_seller_share_check"
    CHECK ("seller_share_pence" >= 0 AND "seller_share_pence" <= "amount_pence"),
  CONSTRAINT "dispute_allocation_clawback_check"
    CHECK ("clawback" IN ('none', 'withdrawn', 'reversed')),
  CONSTRAINT "dispute_allocation_source_check"
    CHECK ("source" IN ('automatic', 'staff', 'legacy')),
  CONSTRAINT "dispute_allocation_case_id_dispute_case_id_fk"
    FOREIGN KEY ("case_id") REFERENCES "public"."dispute_case"("id") ON DELETE restrict,
  CONSTRAINT "dispute_allocation_payment_id_payment_id_fk"
    FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE restrict,
  CONSTRAINT "dispute_allocation_seller_legal_entity_id_legal_entity_id_fk"
    FOREIGN KEY ("seller_legal_entity_id") REFERENCES "public"."legal_entity"("id") ON DELETE restrict,
  CONSTRAINT "dispute_allocation_allocated_by_user_id_user_id_fk"
    FOREIGN KEY ("allocated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "dispute_allocation_case_payment_uidx"
  ON "dispute_allocation" ("case_id", "payment_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dispute_allocation_payment_id_idx"
  ON "dispute_allocation" ("payment_id");

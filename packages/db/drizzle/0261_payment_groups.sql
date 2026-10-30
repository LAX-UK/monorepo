-- Pay several invoices with one payment. A payment group carries the one checkout that settles
-- several invoices of the same buyer account; each invoice keeps its own payment row, which points
-- to the group. Every invoice in a group shares the group's card charge, so the one-charge-per-
-- payment rule now applies to payments outside a group, and the group holds its charge uniquely.
-- Single-invoice payments are unchanged.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_group" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "buyer_legal_entity_id" uuid NOT NULL,
  "created_by_user_id" text,
  "status" text DEFAULT 'open' NOT NULL,
  "currency" text DEFAULT 'GBP' NOT NULL,
  "total_amount" numeric(18, 2) NOT NULL,
  "checkout_rail" text NOT NULL,
  "stripe_checkout_session_id" text,
  "stripe_payment_intent_id" text,
  "stripe_charge_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "settled_at" timestamp with time zone,
  CONSTRAINT "payment_group_status_check"
    CHECK ("status" IN ('open', 'processing', 'paid', 'cancelled')),
  CONSTRAINT "payment_group_rail_check"
    CHECK ("checkout_rail" IN ('card', 'gb_bank_transfer')),
  CONSTRAINT "payment_group_total_check" CHECK ("total_amount" > 0),
  CONSTRAINT "payment_group_buyer_legal_entity_id_legal_entity_id_fk"
    FOREIGN KEY ("buyer_legal_entity_id") REFERENCES "public"."legal_entity"("id") ON DELETE restrict,
  CONSTRAINT "payment_group_created_by_user_id_user_id_fk"
    FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_group_buyer_legal_entity_id_idx"
  ON "payment_group" ("buyer_legal_entity_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_group_stripe_payment_intent_id_uidx"
  ON "payment_group" ("stripe_payment_intent_id")
  WHERE "stripe_payment_intent_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_group_stripe_charge_id_uidx"
  ON "payment_group" ("stripe_charge_id")
  WHERE "stripe_charge_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "payment_group_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "payment"
    ADD CONSTRAINT "payment_payment_group_id_payment_group_id_fk"
    FOREIGN KEY ("payment_group_id") REFERENCES "public"."payment_group"("id") ON DELETE restrict;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_payment_group_id_idx"
  ON "payment" ("payment_group_id")
  WHERE "payment_group_id" IS NOT NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS "payment_stripe_charge_id_uidx";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_stripe_charge_id_uidx"
  ON "payment" ("stripe_charge_id")
  WHERE "stripe_charge_id" IS NOT NULL AND "payment_group_id" IS NULL;

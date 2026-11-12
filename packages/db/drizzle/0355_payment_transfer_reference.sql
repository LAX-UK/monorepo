-- The payment reference each bank-transfer payment tells the sender to quote, kept when it is first
-- known. The payment provider stops showing it once the payment completes, and a transfer applied
-- to a different invoice than its reference names can then only be recognised, and the intended
-- invoice found, from this record. A combined payment's invoices are kept too: a combined payment
-- that is let go no longer holds them, and two payments are one invoice's money when they share one. Only references we issued are kept: no sender-typed text.
-- Append-only (insert and read) and kept with the payment's own records: a reference is a code we
-- issued, not personal data, so it has no separate retention period.
-- Additive: one new table, so the running services keep working until they restart.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_transfer_reference" (
  "stripe_payment_intent_id" text PRIMARY KEY NOT NULL,
  "reference" text NOT NULL,
  "stripe_customer_id" text,
  "payment_id" uuid,
  "payment_group_id" uuid,
  "member_payment_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
  "private_sale_deal_id" uuid,
  "private_sale_deal_payment_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_transfer_reference_customer_idx"
  ON "payment_transfer_reference" ("stripe_customer_id", "created_at" DESC);

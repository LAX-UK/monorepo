-- The payment reference each bank-transfer payment tells the sender to quote, kept when it is first
-- known. The payment provider stops showing it once the payment completes, and a transfer applied
-- to a different invoice than its reference names can then only be recognised, and the intended
-- invoice found, from this record.
-- Additive: one new table, so the running services keep working until they restart.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_transfer_reference" (
  "stripe_payment_intent_id" text PRIMARY KEY NOT NULL,
  "reference" text NOT NULL,
  "payment_id" uuid,
  "payment_group_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_transfer_reference_reference_idx"
  ON "payment_transfer_reference" (upper("reference"));

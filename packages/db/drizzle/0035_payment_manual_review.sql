-- Store the Stripe Charge id separately from PaymentIntent id. Dispute and
-- refund webhooks identify the money movement by charge (`ch_...`), while the
-- legacy column stores PaymentIntent ids (`pi_...`).
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "stripe_charge_id" text;
CREATE UNIQUE INDEX IF NOT EXISTS "payment_stripe_charge_id_uidx"
  ON "payment" ("stripe_charge_id")
  WHERE "stripe_charge_id" IS NOT NULL;

-- New enum value is added in this migration's transaction; the partial unique
-- index that uses the new value as a literal must be created in a later
-- migration (see 0036_payment_manual_review_index.sql) because PostgreSQL
-- forbids using a newly added enum value before the adding transaction commits
-- (SQLSTATE 55P04: "unsafe use of new value of enum type").
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'requires_manual_review';

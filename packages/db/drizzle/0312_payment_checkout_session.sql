-- Every Stripe Checkout session opened for an invoice, so the payment can always be found and
-- closed at Stripe: a session has no payment intent until the buyer confirms, so it cannot be
-- found by the payment's metadata. The expiry job closes each open session and re-reads it before
-- it cancels an invoice, and never cancels one whose money is paid or on its way.
-- Additive: one new table, so the running services keep working until they restart.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_checkout_session" (
  "stripe_session_id" text PRIMARY KEY NOT NULL,
  "payment_id" uuid NOT NULL REFERENCES "payment"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_checkout_session_payment_id_idx"
  ON "payment_checkout_session" ("payment_id");

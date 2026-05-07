-- Add source_event_id to payout_line for Stripe webhook idempotency.
-- Allows tracking the originating Stripe event to prevent duplicate negative lines.

ALTER TABLE "payout_line" ADD COLUMN IF NOT EXISTS "source_event_id" text;

-- Unique constraint on (payout_id, payment_id, kind, source_event_id) for webhook idempotency.
-- Prevents the same Stripe event from inserting duplicate negative lines.
CREATE UNIQUE INDEX IF NOT EXISTS "payout_line_source_event_uidx"
  ON "payout_line" ("payout_id", "payment_id", "kind", "source_event_id")
  WHERE "source_event_id" IS NOT NULL;

-- Update the payment_required check to allow refund/dispute/chargeback lines without payment_id.
-- These lines represent money movements that affect the payout but may not have a direct payment link.
ALTER TABLE "payout_line" DROP CONSTRAINT IF EXISTS "payout_line_payment_required";
ALTER TABLE "payout_line" ADD CONSTRAINT "payout_line_payment_required" CHECK (
  "kind" = 'adjustment'
  OR "kind" IN ('refund', 'dispute', 'chargeback')
  OR "payment_id" IS NOT NULL
);

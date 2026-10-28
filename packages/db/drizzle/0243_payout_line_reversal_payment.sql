-- A reversal line takes back a whole payout, which settles many payments, so it names no single
-- payment. Allow it alongside the other payout-level kinds; every other kind still needs a payment.
ALTER TABLE "payout_line" DROP CONSTRAINT IF EXISTS "payout_line_payment_required";
ALTER TABLE "payout_line" ADD CONSTRAINT "payout_line_payment_required" CHECK (
  "kind" = 'adjustment'
  OR "kind" IN ('refund', 'dispute', 'chargeback', 'reversal')
  OR "payment_id" IS NOT NULL
);

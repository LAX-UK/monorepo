-- Restores the previous check. Reversal lines already written have no payment, so the check is
-- added NOT VALID: it guards new rows and leaves the recorded reversals as they are.
ALTER TABLE "payout_line" DROP CONSTRAINT IF EXISTS "payout_line_payment_required";
ALTER TABLE "payout_line" ADD CONSTRAINT "payout_line_payment_required" CHECK (
  "kind" = 'adjustment'
  OR "kind" IN ('refund', 'dispute', 'chargeback')
  OR "payment_id" IS NOT NULL
) NOT VALID;

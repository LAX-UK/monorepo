-- Rollback: payout_line source_event_id column.

DROP INDEX IF EXISTS "payout_line_source_event_uidx";
ALTER TABLE "payout_line" DROP COLUMN IF EXISTS "source_event_id";

-- Restore original payment_required check (without refund/dispute/chargeback exception)
ALTER TABLE "payout_line" DROP CONSTRAINT IF EXISTS "payout_line_payment_required";
ALTER TABLE "payout_line" ADD CONSTRAINT "payout_line_payment_required" CHECK (
  "kind" = 'adjustment'
  OR "payment_id" IS NOT NULL
);

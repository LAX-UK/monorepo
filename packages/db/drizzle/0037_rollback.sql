-- Rollback: stripe_refund_id on payment.
ALTER TABLE "payment" DROP COLUMN IF EXISTS "stripe_refund_id";

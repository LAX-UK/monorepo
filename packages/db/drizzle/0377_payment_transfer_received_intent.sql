-- Ties payment.transfer_received_pence to the payment intent it was reported for:
--   * payment.transfer_received_payment_intent_id: the intent whose partially-funded notice set the
--     figure. A notice for a different intent replaces the figure instead of raising it, and the Pay
--     page shows the figure only while it belongs to the invoice's current intent, so money sent to
--     an earlier attempt is never shown as received on a new one.
-- Additive: one nullable column on a table the application roles already use.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "transfer_received_payment_intent_id" text;

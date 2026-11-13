-- What a single invoice's bank transfer has delivered so far, so the Pay page can show a part-paid
-- transfer's progress as it does for a combined payment (payment_group.amount_received).
--   * payment.transfer_received_pence: whole pence received into the invoice's own payment intent,
--     from Stripe's partially-funded notice. Only ever raised, and never above the invoice amount,
--     so a replayed or late notice cannot lower or inflate it. Invoices paid together keep their
--     figure on the group and leave this at 0.
-- Additive: one defaulted column on a table the application roles already use, so no grant changes
-- and running services keep working.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "transfer_received_pence" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "payment" DROP CONSTRAINT IF EXISTS "payment_transfer_received_pence_check";
--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_transfer_received_pence_check" CHECK ("payment"."transfer_received_pence" >= 0) NOT VALID;
--> statement-breakpoint
ALTER TABLE "payment" VALIDATE CONSTRAINT "payment_transfer_received_pence_check";

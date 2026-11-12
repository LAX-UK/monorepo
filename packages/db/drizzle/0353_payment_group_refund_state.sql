-- Remember what a combined payment has already refunded for the courier charge, and how much of
-- its refunds no invoice or quote could take, so a refund event is announced once and a later
-- event that adds nothing for them announces nothing.
--   * payment_group_delivery.refunded_pence: the buyer's refunded total for the quote, in pence,
--     capped at what the quote was charged. It lives on the delivery row, not in payment_refund,
--     because that ledger is per payment (payment_id is required) and a courier charge belongs to
--     no invoice.
--   * payment_group.refund_unattributed_pence: the largest refund total, in pence, that no invoice
--     or quote of the group could take. It belongs to the group as a whole.
-- Both are only ever raised, under the group lock. Additive: two defaulted columns on tables the
-- application roles already use, so no grant changes and running services keep working.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "payment_group_delivery" ADD COLUMN IF NOT EXISTS "refunded_pence" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "payment_group" ADD COLUMN IF NOT EXISTS "refund_unattributed_pence" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "payment_group_delivery" DROP CONSTRAINT IF EXISTS "payment_group_delivery_refunded_pence_check";
--> statement-breakpoint
ALTER TABLE "payment_group_delivery" ADD CONSTRAINT "payment_group_delivery_refunded_pence_check" CHECK ("payment_group_delivery"."refunded_pence" >= 0) NOT VALID;
--> statement-breakpoint
ALTER TABLE "payment_group_delivery" VALIDATE CONSTRAINT "payment_group_delivery_refunded_pence_check";
--> statement-breakpoint
ALTER TABLE "payment_group" DROP CONSTRAINT IF EXISTS "payment_group_refund_unattributed_check";
--> statement-breakpoint
ALTER TABLE "payment_group" ADD CONSTRAINT "payment_group_refund_unattributed_check" CHECK ("payment_group"."refund_unattributed_pence" >= 0) NOT VALID;
--> statement-breakpoint
ALTER TABLE "payment_group" VALIDATE CONSTRAINT "payment_group_refund_unattributed_check";

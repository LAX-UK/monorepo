-- Store what a bank transfer has delivered so far for a combined payment, so the payer's Pay page
-- and their Money and Portfolio pages can say how much is still to send.
--   * payment_group.amount_received: money received to date, never above the group's total.
--   * payment_group.received_event_at: the provider's time of the event that set it, so a late
--     delivery of an older event never lowers or overwrites a newer figure.
-- Additive: one defaulted column and one nullable column, so running services keep working.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "payment_group" ADD COLUMN IF NOT EXISTS "amount_received" numeric(18, 2) DEFAULT '0' NOT NULL;
--> statement-breakpoint
ALTER TABLE "payment_group" ADD COLUMN IF NOT EXISTS "received_event_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "payment_group" DROP CONSTRAINT IF EXISTS "payment_group_amount_received_check";
--> statement-breakpoint
ALTER TABLE "payment_group" ADD CONSTRAINT "payment_group_amount_received_check" CHECK ("payment_group"."amount_received" >= 0 and "payment_group"."amount_received" <= "payment_group"."total_amount") NOT VALID;
--> statement-breakpoint
ALTER TABLE "payment_group" VALIDATE CONSTRAINT "payment_group_amount_received_check";

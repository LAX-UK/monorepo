-- Add a payout status for a transfer we must not send or adopt on our own.
-- When Stripe already holds transfers for a payout that do not match it exactly (two live
-- transfers, wrong amount, destination or currency, or a partial reversal), the payout is set to
-- transfer_blocked. The settlement cron and staff retry skip it, so a seller is never paid twice.
-- Widening only: every existing row still satisfies the check, so running services keep working.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "payout" DROP CONSTRAINT IF EXISTS "payout_status_check";
--> statement-breakpoint
ALTER TABLE "payout" ADD CONSTRAINT "payout_status_check" CHECK ("payout"."status" IN ('scheduled', 'in_transit', 'paid', 'failed', 'reversed', 'clawback_pending', 'transfer_blocked')) NOT VALID;
--> statement-breakpoint
ALTER TABLE "payout" VALIDATE CONSTRAINT "payout_status_check";

-- Rollback for 0323_payout_transfer_blocked. Roll back the application release first: it is the
-- only code that writes transfer_blocked. Blocked payouts become failed, with the reason prefixed
-- so staff can tell them apart. Before retrying any of them, compare the payout with the transfers
-- Stripe holds for its transfer_group: the older release does not check for duplicates.
SET LOCAL lock_timeout = '5s';

UPDATE "payout"
SET "status" = 'failed',
    "failure_reason" = 'rolled_back_from_transfer_blocked: ' || COALESCE("failure_reason", 'no reason recorded'),
    "processed_at" = COALESCE("processed_at", now())
WHERE "status" = 'transfer_blocked';

ALTER TABLE "payout" DROP CONSTRAINT IF EXISTS "payout_status_check";
ALTER TABLE "payout" ADD CONSTRAINT "payout_status_check" CHECK ("payout"."status" IN ('scheduled', 'in_transit', 'paid', 'failed', 'reversed', 'clawback_pending')) NOT VALID;
ALTER TABLE "payout" VALIDATE CONSTRAINT "payout_status_check";

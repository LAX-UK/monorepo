-- Rollback for 0267_dispute_cases. Roll back the application release first: the previous release
-- neither reads nor writes these tables. Recorded cases, deadlines and allocations are lost; payout
-- lines already written for a dispute stay on the payouts. Disputes with no matching payment and
-- unallocated "Pay several" disputes are no longer listed anywhere, so export them first.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
DROP TABLE IF EXISTS "dispute_allocation";
--> statement-breakpoint
DROP TABLE IF EXISTS "dispute_case_candidate";
--> statement-breakpoint
DROP TABLE IF EXISTS "dispute_case";

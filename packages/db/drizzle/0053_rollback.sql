DROP INDEX IF EXISTS "absentee_bid_executing_lease_idx";
ALTER TABLE "absentee_bid" DROP COLUMN IF EXISTS "executing_at";

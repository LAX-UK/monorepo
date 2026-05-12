ALTER TABLE "absentee_bid" ADD COLUMN "executing_at" timestamptz;

CREATE INDEX "absentee_bid_executing_lease_idx" ON "absentee_bid" ("executing_at") WHERE "status" = 'executing';

-- Recreate the open-payment partial unique index so it also covers the new
-- 'requires_manual_review' status. Must run in a transaction separate from the
-- one that adds the enum value (see 0035) — PostgreSQL refuses to use a newly
-- added enum value until the adding transaction has committed.
DROP INDEX IF EXISTS "payment_lot_buyer_open_unique";
CREATE UNIQUE INDEX "payment_lot_buyer_open_unique"
  ON "payment" ("lot_id", "buyer_id")
  WHERE "status" IN ('pending', 'authorized', 'captured', 'requires_manual_review');

ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'requires_manual_review';

DROP INDEX IF EXISTS "payment_lot_buyer_open_unique";
CREATE UNIQUE INDEX "payment_lot_buyer_open_unique"
  ON "payment" ("lot_id", "buyer_id")
  WHERE "status" IN ('pending', 'authorized', 'captured', 'requires_manual_review');

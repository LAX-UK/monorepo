ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'requires_manual_review';

DROP INDEX IF EXISTS "payment_lot_buyer_open_unique";
CREATE UNIQUE INDEX "payment_lot_buyer_open_unique"
  ON "payment" ("lot_id", "buyer_id")
  -- Cast to text so PostgreSQL does not require the newly added enum value to be
  -- committed before this migration transaction can create the predicate.
  WHERE "status"::text IN ('pending', 'authorized', 'captured', 'requires_manual_review');

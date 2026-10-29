-- An organisation's purchase can be paid by any of its payers (owners, admins, finance), so a lot
-- carries at most one open payment per buyer account, whichever member started it.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_lot_buyer_open_account_unique"
  ON "payment" ("lot_id", "buyer_legal_entity_id")
  WHERE "status" IN ('pending', 'authorized', 'captured', 'requires_manual_review');

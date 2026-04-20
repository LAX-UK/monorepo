CREATE INDEX IF NOT EXISTS "sale_start_time_idx" ON "sale" USING btree ("start_time");
CREATE INDEX IF NOT EXISTS "bid_lot_id_created_at_idx" ON "bid" USING btree ("lot_id", "created_at" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "bid_one_winner_per_lot_uniq" ON "bid" ("lot_id") WHERE "is_winning" = true;

-- Schema parity with migration 0006 (the partial unique was applied at runtime but was
-- not reflected in the Drizzle snapshot). IF NOT EXISTS keeps this idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS "payment_lot_buyer_open_unique"
  ON "payment" ("lot_id", "buyer_id")
  WHERE "status" IN ('pending','authorized','captured');

DO $$
BEGIN
  ALTER TABLE "sale" ADD CONSTRAINT "sale_end_after_start" CHECK ("end_time" > "start_time");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

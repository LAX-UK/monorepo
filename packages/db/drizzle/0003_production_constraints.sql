-- Auction bidding / Dutch options
ALTER TABLE "auction" ADD COLUMN IF NOT EXISTS "min_bid_increment" numeric(18, 2) NOT NULL DEFAULT '1.00';
ALTER TABLE "auction" ADD COLUMN IF NOT EXISTS "dutch_decrement_amount" numeric(18, 2);
ALTER TABLE "auction" ADD COLUMN IF NOT EXISTS "dutch_decrement_interval_ms" integer NOT NULL DEFAULT 60000;
ALTER TABLE "auction" ADD COLUMN IF NOT EXISTS "dutch_last_decrement_at" timestamp with time zone;

-- Category tree integrity (self-reference)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'category_parent_id_category_id_fk'
  ) THEN
    ALTER TABLE "category" ADD CONSTRAINT "category_parent_id_category_id_fk"
      FOREIGN KEY ("parent_id") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

-- One in-flight payment per buyer per auction (allows new row after refund if needed: use partial index)
CREATE UNIQUE INDEX IF NOT EXISTS "payment_auction_buyer_open_unique"
  ON "payment" ("auction_id", "buyer_id")
  WHERE "status" IN ('pending', 'authorized', 'captured');

-- Data integrity
ALTER TABLE "auction" DROP CONSTRAINT IF EXISTS "auction_end_after_start";
ALTER TABLE "auction" ADD CONSTRAINT "auction_end_after_start" CHECK ("end_time" > "start_time");

ALTER TABLE "auction" DROP CONSTRAINT IF EXISTS "auction_reserve_ge_start";
ALTER TABLE "auction" ADD CONSTRAINT "auction_reserve_ge_start" CHECK (
  "reserve_price" IS NULL OR "reserve_price" >= "starting_price"
);

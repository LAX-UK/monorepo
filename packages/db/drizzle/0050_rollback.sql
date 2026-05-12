ALTER TABLE "bid" DROP COLUMN IF EXISTS "telephone_booking_id";
ALTER TABLE "bid" DROP COLUMN IF EXISTS "placed_via";
DROP TABLE IF EXISTS "telephone_bid_booking";
DROP TYPE IF EXISTS "telephone_bid_booking_status";
DROP TABLE IF EXISTS "absentee_bid";
DROP TYPE IF EXISTS "absentee_bid_status";

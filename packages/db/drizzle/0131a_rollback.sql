-- Drops ATG link state only. Sales and lots on ATG are untouched; re-pushing after a
-- rollback would create duplicate ATG auctions, so export atg_auction_link first.
DROP TABLE IF EXISTS "atg_lot_link";
DROP TABLE IF EXISTS "atg_auction_link";

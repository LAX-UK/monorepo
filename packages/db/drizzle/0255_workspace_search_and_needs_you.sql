-- Record search inside an account reads the lots bid on for an organisation, or by one member for
-- it (a buyer agent's own bids). One index on (account, bidder, lot) serves both as an index-only
-- scan, so the search costs the size of the account's bids, not of every bid.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bid_buyer_entity_bidder_lot_idx"
  ON "bid" ("buyer_legal_entity_id", "bidder_id", "lot_id");

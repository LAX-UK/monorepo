-- Hot-path indexes for user dashboard queries (bids by bidder, watchlist by user recency).

CREATE INDEX IF NOT EXISTS "bid_bidder_id_created_at_idx" ON "bid" ("bidder_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "watchlist_user_id_created_at_idx" ON "watchlist" ("user_id", "created_at" DESC);

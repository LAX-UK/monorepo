-- Rollback for 0255_workspace_search_and_needs_you. Search still works without the index; it
-- reads an account's bids through `bid_buyer_legal_entity_id_idx` instead.
SET LOCAL lock_timeout = '30s';

DROP INDEX IF EXISTS "bid_buyer_entity_bidder_lot_idx";

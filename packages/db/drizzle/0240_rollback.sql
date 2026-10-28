-- Drops the index Home uses to find an organisation's scheduled absentee bids. Safe at any time:
-- the read falls back to a scan.
DROP INDEX IF EXISTS "absentee_bid_buyer_entity_scheduled_idx";

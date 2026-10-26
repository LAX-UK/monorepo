-- Drops per-sale ATG settings; the worker then has no auction type or distribution to send,
-- so roll back the application release first.
ALTER TABLE "atg_lot_link" DROP COLUMN IF EXISTS "locked_fields_hash";

ALTER TABLE "atg_auction_link" DROP CONSTRAINT IF EXISTS "atg_auction_link_distribution_check";

ALTER TABLE "atg_auction_link" DROP CONSTRAINT IF EXISTS "atg_auction_link_auction_type_check";

ALTER TABLE "atg_auction_link" DROP COLUMN IF EXISTS "settings_updated_by";

ALTER TABLE "atg_auction_link" DROP COLUMN IF EXISTS "settings_updated_at";

ALTER TABLE "atg_auction_link" DROP COLUMN IF EXISTS "distribution";

ALTER TABLE "atg_auction_link" DROP COLUMN IF EXISTS "auction_type";

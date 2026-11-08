-- Rollback for 0329_shop_framing_catalogue. Roll back the application release first. Dropping the
-- tables loses the catalogue: the options, their prices and which editions offered them. Staff
-- re-enter them after a re-apply (the four launch options come back as drafts).
SET LOCAL lock_timeout = '30s';

DROP TABLE IF EXISTS "shop_framing_edition_offer";
DROP TABLE IF EXISTS "shop_framing_option_price";
DROP TABLE IF EXISTS "shop_framing_option";

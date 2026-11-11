-- Rollback for 0358_bid_catalogue_setting. Roll back the application release first: the previous
-- release neither reads nor writes the table. The table only holds the publish switch.
SET LOCAL lock_timeout = '30s';

DROP TABLE IF EXISTS "bid_catalogue_setting";

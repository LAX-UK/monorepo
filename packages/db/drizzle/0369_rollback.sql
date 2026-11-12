-- Rollback for 0369_shop_home_cover. The chosen cover picture is dropped with the table; the Shop
-- home then leads with the newest edition, as it did before the picture could be chosen. Roll
-- back the release first, then this.
BEGIN;

SET LOCAL lock_timeout = '5s';
DROP TABLE IF EXISTS "shop_home_cover";

COMMIT;

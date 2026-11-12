-- Rollback for 0363_private_sale_deal_artwork_history. Roll back the application release first: the
-- previous release neither reads nor writes the table. The artwork history it holds is lost; the
-- deals themselves and their stage history are untouched.
BEGIN;

SET LOCAL lock_timeout = '5s';

DROP TRIGGER IF EXISTS "private_sale_deal_artwork_history_guard" ON "private_sale_deal_artwork_history";
DROP FUNCTION IF EXISTS "private_sale_deal_artwork_history_guard"();
DROP TABLE IF EXISTS "private_sale_deal_artwork_history";

COMMIT;

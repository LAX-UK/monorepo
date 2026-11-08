-- Rollback for 0328_private_sale_deal_party_history. The history of who was named on each deal is
-- lost; the current parties and the party-named events stay. Roll back the application release
-- first, because erasure reads this table.
BEGIN;

SET LOCAL lock_timeout = '5s';
DROP TABLE IF EXISTS "private_sale_deal_party_history";

COMMIT;

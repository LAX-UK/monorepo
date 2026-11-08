-- Rollback for 0328_private_sale_deal_party_history. The history of who was named on each deal is
-- lost; the current parties and the party-named events stay. Roll back the application release
-- first, because erasure reads this table.
SET LOCAL lock_timeout = '5s';
DROP TRIGGER IF EXISTS "private_sale_deal_party_history_append_only" ON "private_sale_deal_party_history";
DROP FUNCTION IF EXISTS "private_sale_deal_party_history_append_only"();
DROP TABLE IF EXISTS "private_sale_deal_party_history";

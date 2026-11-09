-- Rollback for 0336_private_sale_deal_party_history_entities. The rows for organisations named
-- without a person are removed (they cannot exist where a person is required), so that record of
-- who was named on a deal is lost; the trigger that refuses changes is lifted for the delete and
-- put back. Roll back the application release first.
SET LOCAL lock_timeout = '5s';
ALTER TABLE "private_sale_deal_party_history" DISABLE TRIGGER "private_sale_deal_party_history_append_only";
DELETE FROM "private_sale_deal_party_history" WHERE "acting_user_id" IS NULL;
ALTER TABLE "private_sale_deal_party_history" ENABLE TRIGGER "private_sale_deal_party_history_append_only";
DROP INDEX IF EXISTS "private_sale_deal_party_history_entity_idx";
DROP INDEX IF EXISTS "private_sale_deal_party_history_entity_uidx";
ALTER TABLE "private_sale_deal_party_history" DROP CONSTRAINT IF EXISTS "private_sale_deal_party_history_who_check";
ALTER TABLE "private_sale_deal_party_history" ALTER COLUMN "acting_user_id" SET NOT NULL;

ALTER TABLE "legal_entity" DROP COLUMN IF EXISTS "stripe_customer_id";
DROP INDEX IF EXISTS "legal_entity_stripe_customer_id_uidx";

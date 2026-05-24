ALTER TABLE "legal_entity" ADD COLUMN IF NOT EXISTS "stripe_customer_id" text;
CREATE UNIQUE INDEX IF NOT EXISTS "legal_entity_stripe_customer_id_uidx" ON "legal_entity" ("stripe_customer_id") WHERE "stripe_customer_id" IS NOT NULL;

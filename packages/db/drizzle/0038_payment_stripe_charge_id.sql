-- Repair: some environments have drizzle.__drizzle_migrations marking 0035 applied
-- while `stripe_charge_id` was never created (e.g. 0035 SQL changed after apply).
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "stripe_charge_id" text;
CREATE UNIQUE INDEX IF NOT EXISTS "payment_stripe_charge_id_uidx"
  ON "payment" ("stripe_charge_id")
  WHERE ("stripe_charge_id" IS NOT NULL);

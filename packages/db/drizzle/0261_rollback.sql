-- Rollback for 0261_payment_groups. Roll back the application release first: the previous
-- release neither reads nor writes payment groups. Groups whose checkout is still open are lost
-- (their invoices stay due on their own). A paid group's invoices share one card charge, which the
-- previous one-charge-per-payment rule cannot hold, so the rollback stops while any exists: refund
-- or reconcile those by hand first.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM "payment"
    WHERE "payment_group_id" IS NOT NULL AND "stripe_charge_id" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'payment groups with a shared charge exist; reconcile them before rolling back 0261';
  END IF;
END $$;
--> statement-breakpoint
DROP INDEX IF EXISTS "payment_stripe_charge_id_uidx";
--> statement-breakpoint
DROP INDEX IF EXISTS "payment_payment_group_id_idx";
--> statement-breakpoint
ALTER TABLE "payment" DROP CONSTRAINT IF EXISTS "payment_payment_group_id_payment_group_id_fk";
--> statement-breakpoint
ALTER TABLE "payment" DROP COLUMN IF EXISTS "payment_group_id";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_stripe_charge_id_uidx"
  ON "payment" ("stripe_charge_id")
  WHERE "stripe_charge_id" IS NOT NULL;
--> statement-breakpoint
DROP TABLE IF EXISTS "payment_group";

-- Rollback for 0323_payment_group_delivery. Roll back the application release first: it writes the
-- table when a payment includes a courier quote and reads it to settle that payment. The rollback
-- stops while any payment still carries a delivery charge, because dropping the table would lose
-- what was charged for it: reconcile those payments by hand first.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "payment_group_delivery") THEN
    RAISE EXCEPTION 'payment groups carry delivery charges; reconcile them before rolling back 0323';
  END IF;
END $$;
--> statement-breakpoint
DROP TABLE IF EXISTS "payment_group_delivery";

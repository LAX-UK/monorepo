-- Rollback for 0393_payment_group_delivery_refund. Roll the release back first: it writes a row
-- before each staff courier refund. The rollback stops while any row exists, because dropping the
-- table would lose the staff reason and the Stripe refund each request made: export them for the
-- finance record first, then delete them. Also removes this migration's ledger row so a later
-- deploy reapplies it.
BEGIN;

SET LOCAL lock_timeout = '5s';

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "payment_group_delivery_refund") THEN
    RAISE EXCEPTION 'courier refund requests are recorded; export and delete them before rolling back 0393';
  END IF;
END $$;

DROP TABLE IF EXISTS "payment_group_delivery_refund";

DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1812196800000;

COMMIT;

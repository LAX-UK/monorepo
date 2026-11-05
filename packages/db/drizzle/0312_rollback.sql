-- Rollback for 0312_payment_checkout_session. Roll back the application release first: the
-- previous release neither reads nor writes this table. Open Checkout sessions are then found
-- again only through their payment intent, as before.
SET LOCAL lock_timeout = '30s';

DROP TABLE IF EXISTS "payment_checkout_session";

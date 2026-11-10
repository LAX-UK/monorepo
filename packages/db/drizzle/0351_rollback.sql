-- Rollback for 0351_payment_checkout_session_parameters. Roll back the application release first:
-- the previous release neither reads nor writes these columns. Sessions are then found again by
-- payment, as before.
SET LOCAL lock_timeout = '5s';

ALTER TABLE "payment_checkout_session" DROP COLUMN IF EXISTS "closed_at";
ALTER TABLE "payment_checkout_session" DROP COLUMN IF EXISTS "parameters_fingerprint";
ALTER TABLE "payment_checkout_session" DROP COLUMN IF EXISTS "rail";

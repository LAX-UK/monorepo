-- A Checkout session now records its rail, the fingerprint of the parameters it was opened for
-- and when it was found closed. Paying again then finds the buyer's own open session instead of
-- opening another, and a new checkout closes only the same rail's superseded sessions.
-- Additive and nullable: sessions opened before this stay readable and are closed once.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "payment_checkout_session" ADD COLUMN IF NOT EXISTS "rail" text;
--> statement-breakpoint
ALTER TABLE "payment_checkout_session" ADD COLUMN IF NOT EXISTS "parameters_fingerprint" text;
--> statement-breakpoint
ALTER TABLE "payment_checkout_session" ADD COLUMN IF NOT EXISTS "closed_at" timestamp with time zone;

-- Better Auth 1.6.22's two-factor plugin counts failed code attempts and locks the factor for a
-- while after too many (`failedVerificationCount`, `lockedUntil`). Without these columns every
-- 2FA verification fails with "field does not exist in the twoFactor schema" and returns a 500.
-- Additive with a default, so the running auth service keeps working until it restarts.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "two_factor" ADD COLUMN IF NOT EXISTS "failed_verification_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "two_factor" ADD COLUMN IF NOT EXISTS "locked_until" timestamp with time zone;

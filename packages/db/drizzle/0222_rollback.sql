ALTER TABLE "two_factor" DROP COLUMN IF EXISTS "locked_until";

ALTER TABLE "two_factor" DROP COLUMN IF EXISTS "failed_verification_count";

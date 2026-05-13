DROP INDEX IF EXISTS "processed_stripe_events_source_idx";
DROP TABLE IF EXISTS "processed_stripe_events";

ALTER TABLE "user" DROP COLUMN IF EXISTS "current_kyc_session_id";
ALTER TABLE "user" DROP COLUMN IF EXISTS "kyc_retry_count";

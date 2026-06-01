DROP INDEX IF EXISTS "kyc_watchlist_screening_decision_outcome_idx";
DROP INDEX IF EXISTS "kyc_watchlist_screening_review_status_idx";
DROP INDEX IF EXISTS "kyc_watchlist_screening_user_id_idx";
DROP TABLE IF EXISTS "kyc_watchlist_screening";

ALTER TABLE "user" DROP COLUMN IF EXISTS "aml_hold_at";
ALTER TABLE "user" DROP COLUMN IF EXISTS "aml_hold_reason";
ALTER TABLE "user" DROP COLUMN IF EXISTS "aml_hold_status";

DROP TYPE IF EXISTS "aml_review_status";
DROP TYPE IF EXISTS "aml_decision_outcome";
DROP TYPE IF EXISTS "aml_monitor_status";
DROP TYPE IF EXISTS "aml_match_status";
DROP TYPE IF EXISTS "user_aml_hold_status";

-- Note: the 'compliance_officer' value added to "user_staff_role" cannot be
-- removed without recreating the enum; it is intentionally left in place.

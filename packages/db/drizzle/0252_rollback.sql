-- Rollback for 0252_organisation_bidding_limits. Roll back the application release first: the
-- previous release neither reads nor writes these limits. Totals on authorisations and
-- organisation limits are lost; bidding falls back to per-lot limits only.
SET LOCAL lock_timeout = '30s';

DROP TABLE IF EXISTS "legal_entity_bidding_limit";

ALTER TABLE "buyer_agent_authorisation" DROP CONSTRAINT IF EXISTS "buyer_agent_auth_total_limit_positive";

ALTER TABLE "buyer_agent_authorisation" DROP COLUMN IF EXISTS "total_limit";

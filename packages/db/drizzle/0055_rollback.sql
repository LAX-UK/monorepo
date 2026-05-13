BEGIN;

ALTER TABLE "bid" DROP CONSTRAINT IF EXISTS "bid_placed_via_check";

DROP INDEX IF EXISTS "buyer_agent_auth_active_uidx";
DROP INDEX IF EXISTS "buyer_agent_auth_entity_user_active_idx";

CREATE INDEX "buyer_agent_auth_entity_user_active_idx"
  ON "buyer_agent_authorisation" ("legal_entity_id", "user_id")
  WHERE "status" = 'active';

COMMIT;

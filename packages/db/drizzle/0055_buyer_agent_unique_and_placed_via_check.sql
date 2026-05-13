BEGIN;

-- Buyer-agent authorisation: at most one ACTIVE row per (legal_entity, user, sale-scope).
-- The previous non-unique index allowed multiple overlapping active authorisations, which
-- broke the "single source of truth for a buyer-agent's cap" assumption in bid eligibility.
-- COALESCE collapses NULL sale_id (global authorisation) into a sentinel zero UUID so that
-- (entity, user, NULL) and (entity, user, saleX) remain distinct slots.
DROP INDEX IF EXISTS "buyer_agent_auth_entity_user_active_idx";

-- Backfill: clear duplicate active rows by keeping the most-recently-created and revoking the rest.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY legal_entity_id, user_id, COALESCE(sale_id, '00000000-0000-0000-0000-000000000000'::uuid)
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM "buyer_agent_authorisation"
  WHERE status = 'active'
)
UPDATE "buyer_agent_authorisation" b
SET
  status = 'revoked',
  revoked_at = now(),
  revoked_reason = 'superseded_by_unique_constraint'
FROM ranked r
WHERE b.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX "buyer_agent_auth_active_uidx"
  ON "buyer_agent_authorisation" (
    "legal_entity_id",
    "user_id",
    (COALESCE("sale_id", '00000000-0000-0000-0000-000000000000'::uuid))
  )
  WHERE "status" = 'active';

-- Restore the non-unique lookup index used by eligibility queries that filter by (entity, user, status).
CREATE INDEX "buyer_agent_auth_entity_user_active_idx"
  ON "buyer_agent_authorisation" ("legal_entity_id", "user_id")
  WHERE "status" = 'active';

-- bid.placed_via: previously plain text. Enforce the documented vocabulary.
-- NULL is allowed (legacy rows / direct web bids that pre-date the column).
ALTER TABLE "bid" ADD CONSTRAINT "bid_placed_via_check"
  CHECK ("placed_via" IS NULL OR "placed_via" IN ('web', 'absentee', 'telephone', 'saleroom'));

COMMIT;

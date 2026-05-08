-- Rollback: 0028_legal_entity_final_cutover.sql
--
-- Restores legacy user-id columns dropped in 0028 as nullable `text`, then
-- best-effort backfills from `legal_entity.created_by_user_id` by joining the
-- legal-entity ownership column on each row.
--
-- CAVEATS (read before running):
-- - Entities with multiple members: backfill uses `legal_entity.created_by_user_id`
--   only, not `legal_entity_member` or another rule. That user may not match the
--   original pre-0028 `seller_id` / `created_by` semantics when the entity has many
--   members or ownership changed after entity creation.
-- - Rows created after 0028 ran therefore get approximate legacy values at best;
--   schema is restored but data fidelity for post-0028 rows is not guaranteed.
-- - For full data fidelity, prefer a point-in-time restore from backup over relying
--   on this forward+rollback path.
--
-- Deployment: assume application code is rolled back to a version that still reads
-- these legacy columns before you depend on them. Running this while new code is
-- live only reintroduces nullable columns that new code ignores; it is usually safe
-- at the SQL layer but is not a substitute for a coordinated code rollback.

ALTER TABLE "lot" ADD COLUMN IF NOT EXISTS "seller_id" text;
ALTER TABLE "item_submission" ADD COLUMN IF NOT EXISTS "seller_id" text;
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "seller_id" text;
ALTER TABLE "sale" ADD COLUMN IF NOT EXISTS "created_by" text;

UPDATE "lot" AS l
SET "seller_id" = e."created_by_user_id"
FROM "legal_entity" AS e
WHERE l."seller_legal_entity_id" = e."id";

UPDATE "item_submission" AS s
SET "seller_id" = e."created_by_user_id"
FROM "legal_entity" AS e
WHERE s."legal_entity_id" = e."id";

UPDATE "payment" AS p
SET "seller_id" = e."created_by_user_id"
FROM "legal_entity" AS e
WHERE p."seller_legal_entity_id" = e."id";

UPDATE "sale" AS s
SET "created_by" = e."created_by_user_id"
FROM "legal_entity" AS e
WHERE s."created_by_legal_entity_id" = e."id";

CREATE INDEX IF NOT EXISTS "lot_seller_id_idx" ON "lot" ("seller_id");
CREATE INDEX IF NOT EXISTS "item_submission_seller_id_idx" ON "item_submission" ("seller_id");
CREATE INDEX IF NOT EXISTS "sale_created_by_idx" ON "sale" ("created_by");

-- Rollback for 0374_accounting_reference_per_target. Roll back the release first, then this.
-- It puts back one document per reference. If a reference was already registered for more than
-- one target (a rehearsal and a test or live document), the old index cannot be built and this
-- rollback stops with a unique violation, changing nothing: those rows are append-only history
-- and are never deleted to make room. Also removes this migration's ledger row so a later deploy
-- reapplies it.
BEGIN;

SET LOCAL lock_timeout = '5s';
CREATE UNIQUE INDEX IF NOT EXISTS "accounting_document_reference_uid"
  ON "accounting_document" ("product", "legal_entity", "lax_reference");
ALTER TABLE "accounting_document" DROP CONSTRAINT IF EXISTS "accounting_document_reference_target_uq";

DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1810468800000;

COMMIT;

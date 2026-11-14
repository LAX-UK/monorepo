-- Rollback for 0390_consignment_agreement_versions. Roll the release back first: nothing may still
-- supersede an agreement. Agreements lose their version number and superseded marks, and the
-- consignment's agreement is again one row, updated in place.
--
-- Forward-fix only once a version has been superseded. The previous release keeps one agreement
-- row per consignment; with two, its unique index cannot be rebuilt and its reads would pick either
-- row. The rollback stops while any superseded version exists. To check first:
--   SELECT count(*) FROM "consignment_agreement" WHERE "superseded_at" IS NOT NULL;
-- Also removes this migration's ledger row so a later deploy reapplies it.
BEGIN;

SET LOCAL lock_timeout = '30s';
LOCK TABLE "consignment_agreement" IN SHARE MODE;
-- The column is gone once the rollback has run, so it is read only while it is there.
DO $$
DECLARE
  superseded bigint;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'consignment_agreement'
      AND column_name = 'superseded_at'
  ) THEN
    SELECT count(*) INTO superseded FROM "consignment_agreement" WHERE "superseded_at" IS NOT NULL;
    IF superseded > 0 THEN
      RAISE EXCEPTION '% superseded agreement version(s) exist; 0390 is forward-fix only once an agreement has been versioned', superseded;
    END IF;
  END IF;
END $$;
DROP TRIGGER IF EXISTS "consignment_agreement_superseded_frozen" ON "consignment_agreement";
DROP FUNCTION IF EXISTS "consignment_agreement_superseded_frozen"();
DROP INDEX IF EXISTS "consignment_agreement_submission_version_uidx";
DROP INDEX IF EXISTS "consignment_agreement_submission_id_uidx";
CREATE UNIQUE INDEX IF NOT EXISTS "consignment_agreement_submission_id_uidx"
  ON "consignment_agreement" USING btree ("submission_id");
ALTER TABLE "consignment_agreement" DROP CONSTRAINT IF EXISTS "consignment_agreement_version_ck";
ALTER TABLE "consignment_agreement" DROP CONSTRAINT IF EXISTS "consignment_agreement_superseded_ck";
ALTER TABLE "consignment_agreement" DROP CONSTRAINT IF EXISTS "consignment_agreement_superseded_by_fkey";
ALTER TABLE "consignment_agreement"
  DROP COLUMN IF EXISTS "superseded_by",
  DROP COLUMN IF EXISTS "superseded_at",
  DROP COLUMN IF EXISTS "version";

DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1812024000000;

COMMIT;

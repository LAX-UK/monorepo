-- Rollback for 0407_consignor_agreement. Roll the release back first: the previous release
-- neither reads nor writes these tables. The agreements and consignor links are the only record
-- of what each consignor agreed and who consigned each work, so this refuses while any exist
-- (export them first, then delete them as the owner with the triggers disabled).
-- Also removes this migration's ledger row so a later deploy reapplies it.
BEGIN;

SET LOCAL lock_timeout = '30s';

-- Nested, not AND: the whole condition is planned at once, which fails once the table is gone.
DO $$
BEGIN
  IF to_regclass('public.artwork_consignor_link') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM "artwork_consignor_link") THEN
      RAISE EXCEPTION 'artwork_consignor_link holds consignors; export them before rolling back';
    END IF;
  END IF;
  IF to_regclass('public.consignor_agreement') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM "consignor_agreement") THEN
      RAISE EXCEPTION 'consignor_agreement holds agreements; export them before rolling back';
    END IF;
  END IF;
END $$;

DROP TABLE IF EXISTS "artwork_consignor_link";
DROP FUNCTION IF EXISTS artwork_consignor_link_append_only();
DROP FUNCTION IF EXISTS artwork_consignor_link_reason();
DROP TABLE IF EXISTS "consignor_agreement";
DROP FUNCTION IF EXISTS consignor_agreement_frozen();
DROP FUNCTION IF EXISTS consignor_agreement_lineage();

DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1813406400000;

COMMIT;

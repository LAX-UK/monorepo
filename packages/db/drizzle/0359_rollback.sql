-- Rollback for 0352_artwork_register_status_written. Roll back the application release first: the
-- previous release neither reads nor writes the column or raises Status conflicts.
-- Conflicts are kept as history, so this refuses while any Status conflict exists.
SET LOCAL lock_timeout = '30s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "artwork_register_conflict" WHERE "field" = 'catalogueStatus') THEN
    RAISE EXCEPTION 'artwork_register_conflict holds catalogueStatus rows; keep the wider check';
  END IF;
END $$;

ALTER TABLE "artwork_register_conflict" DROP CONSTRAINT IF EXISTS "artwork_register_conflict_field_check";
ALTER TABLE "artwork_register_conflict" ADD CONSTRAINT "artwork_register_conflict_field_check" CHECK (
  "field" IN ('stockCode', 'kind', 'sourceOriginalId', 'offerState')
);

ALTER TABLE "artwork_register" DROP COLUMN IF EXISTS "catalogue_status_written";

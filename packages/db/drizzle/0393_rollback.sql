-- Rollback for 0393_collection_storage_terms. Roll the release back first: nothing may still read
-- or write the new tables or columns. Storage terms, extensions, waivers, the audit rows, the
-- large-work marks and the terms each lot was sold under are deleted with them. The weekly charge
-- column (storage_charge_pence) was never touched. free_storage_days was left in place, so the free
-- period still applies. Also removes this migration's ledger row so a later deploy reapplies it.
BEGIN;

SET LOCAL lock_timeout = '5s';

DROP TABLE IF EXISTS "collection_storage_audit";
DROP TABLE IF EXISTS "collection_storage_waiver";
DROP TABLE IF EXISTS "collection_storage_extension";

DROP INDEX IF EXISTS "lot_fulfilment_storage_terms_idx";
ALTER TABLE "lot_fulfilment" DROP CONSTRAINT IF EXISTS "lot_fulfilment_storage_terms_id_fk";
ALTER TABLE "lot_fulfilment" DROP COLUMN IF EXISTS "storage_terms_id";
ALTER TABLE "lot" DROP COLUMN IF EXISTS "storage_large";

ALTER TABLE "collection_place" DROP CONSTRAINT IF EXISTS "collection_place_charging_needs_vat_check";
ALTER TABLE "collection_place" DROP CONSTRAINT IF EXISTS "collection_place_storage_vat_check";
ALTER TABLE "collection_place" DROP COLUMN IF EXISTS "storage_vat_treatment";
ALTER TABLE "collection_place" DROP COLUMN IF EXISTS "raise_storage_invoices";

DROP TABLE IF EXISTS "collection_storage_terms";

DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1812196800000;

COMMIT;

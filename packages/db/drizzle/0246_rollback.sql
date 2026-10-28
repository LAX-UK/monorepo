-- Rolls back 0246. Run only after shop-api no longer reads or writes runs, facts or stock batches.
-- Prints with no edition number (open editions and proofs) cannot exist once the column is NOT
-- NULL again, so they are deleted. That fails, and so stops the rollback, if an order line points
-- at one; on a database that has sold none, nothing is lost.
DROP INDEX IF EXISTS "shop_certificate_reference_uid";

ALTER TABLE "shop_certificate" DROP CONSTRAINT IF EXISTS "shop_certificate_vocabulary_ck";

ALTER TABLE "shop_certificate"
  DROP COLUMN IF EXISTS "form",
  DROP COLUMN IF EXISTS "issuer",
  DROP COLUMN IF EXISTS "certificate_reference";

ALTER TABLE "shop_order_line"
  DROP COLUMN IF EXISTS "swapped_from_edition_id",
  DROP COLUMN IF EXISTS "pack_confirmed_by",
  DROP COLUMN IF EXISTS "pack_confirmed_at",
  DROP COLUMN IF EXISTS "print_label",
  DROP COLUMN IF EXISTS "edition_facts_snapshot";

DROP INDEX IF EXISTS "shop_edition_listing_sellable_stock_idx";

DROP INDEX IF EXISTS "shop_edition_label_code_uid";

DROP INDEX IF EXISTS "shop_edition_artwork_stock_ref_uid";

DROP TRIGGER IF EXISTS "shop_edition_default_stock_ref_trg" ON "shop_edition";

DROP FUNCTION IF EXISTS "shop_edition_default_stock_ref"();

ALTER TABLE "shop_edition" DROP CONSTRAINT IF EXISTS "shop_edition_numbers_ck";

ALTER TABLE "shop_edition" DROP CONSTRAINT IF EXISTS "shop_edition_stock_ref_positive_ck";

DELETE FROM "shop_edition" WHERE "edition_number" IS NULL;

ALTER TABLE "shop_edition"
  DROP COLUMN IF EXISTS "label_code",
  DROP COLUMN IF EXISTS "storage_location",
  DROP COLUMN IF EXISTS "proof_number",
  DROP COLUMN IF EXISTS "stock_ref";

ALTER TABLE "shop_edition" ALTER COLUMN "edition_number" SET NOT NULL;

DROP TABLE IF EXISTS "shop_edition_stock_batch";

DROP TABLE IF EXISTS "shop_edition_facts";

DROP INDEX IF EXISTS "shop_artwork_main_run_idx";

ALTER TABLE "shop_artwork"
  DROP CONSTRAINT IF EXISTS "shop_artwork_run_proofs_kept_ck",
  DROP CONSTRAINT IF EXISTS "shop_artwork_run_link_ck",
  DROP CONSTRAINT IF EXISTS "shop_artwork_run_open_ck",
  DROP CONSTRAINT IF EXISTS "shop_artwork_run_sellable_owner_ck",
  DROP CONSTRAINT IF EXISTS "shop_artwork_run_buyer_original_ck",
  DROP CONSTRAINT IF EXISTS "shop_artwork_run_allocation_ck",
  DROP CONSTRAINT IF EXISTS "shop_artwork_run_template_ck",
  DROP CONSTRAINT IF EXISTS "shop_artwork_run_standard_ck",
  DROP CONSTRAINT IF EXISTS "shop_artwork_run_size_ck",
  DROP CONSTRAINT IF EXISTS "shop_artwork_run_presence_ck",
  DROP CONSTRAINT IF EXISTS "shop_artwork_run_vocabulary_ck";

ALTER TABLE "shop_artwork"
  DROP COLUMN IF EXISTS "proofs_kept_bat",
  DROP COLUMN IF EXISTS "proofs_kept_hc",
  DROP COLUMN IF EXISTS "proofs_kept_pp",
  DROP COLUMN IF EXISTS "proofs_kept_ap",
  DROP COLUMN IF EXISTS "proof_type",
  DROP COLUMN IF EXISTS "main_run_artwork_id",
  DROP COLUMN IF EXISTS "open_default_artist_pct",
  DROP COLUMN IF EXISTS "alloc_lax",
  DROP COLUMN IF EXISTS "alloc_artist",
  DROP COLUMN IF EXISTS "alloc_buyer",
  DROP COLUMN IF EXISTS "run_size",
  DROP COLUMN IF EXISTS "run_template",
  DROP COLUMN IF EXISTS "run_role",
  DROP COLUMN IF EXISTS "run_kind";

-- Rollback for 0329_shop_print_facts. Roll back the application release first: the previous
-- release does not read these columns. The stamp, parties and authority recorded by this
-- migration are lost, and the printers and publishers list is dropped.
BEGIN;

SET LOCAL lock_timeout = '5s';
DROP TABLE IF EXISTS "shop_print_party";
ALTER TABLE "shop_edition_facts"
  DROP CONSTRAINT IF EXISTS "shop_edition_facts_authority_giver_ck",
  DROP CONSTRAINT IF EXISTS "shop_edition_facts_published_by_ck",
  DROP CONSTRAINT IF EXISTS "shop_edition_facts_printed_by_ck",
  DROP CONSTRAINT IF EXISTS "shop_edition_facts_stamp_ck";
ALTER TABLE "shop_edition_facts"
  DROP COLUMN IF EXISTS "certificate_authority_dated_on",
  DROP COLUMN IF EXISTS "certificate_authority_given_by",
  DROP COLUMN IF EXISTS "published_by_name",
  DROP COLUMN IF EXISTS "published_by_kind",
  DROP COLUMN IF EXISTS "printed_by",
  DROP COLUMN IF EXISTS "stamp";

COMMIT;

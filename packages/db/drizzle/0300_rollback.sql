-- Rollback for 0300_sale_test_flag. Roll back the application release first: once the column is
-- gone, a test sale becomes an ordinary sale and, if it is no longer a draft, public. This refuses
-- while any sale is still flagged, so unflag or delete test sales first.
SET LOCAL lock_timeout = '30s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "sale" WHERE "is_test" = true) THEN
    RAISE EXCEPTION 'sale has test sales; unflag or delete them before rolling back';
  END IF;
END $$;

ALTER TABLE "sale" DROP COLUMN IF EXISTS "is_test";

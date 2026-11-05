-- Rollback for 0311_artwork_register_print_code. Roll back the application release first. Codes
-- are never renamed, so this refuses while any LAX-PRT- code exists and the wider check stays.
SET LOCAL lock_timeout = '30s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "artwork_register" WHERE "stock_code" LIKE 'LAX-PRT-%') THEN
    RAISE EXCEPTION 'artwork_register holds LAX-PRT- codes; keep the wider check';
  END IF;
END $$;

ALTER TABLE "artwork_register" DROP CONSTRAINT IF EXISTS "artwork_register_stock_code_check";
ALTER TABLE "artwork_register" ADD CONSTRAINT "artwork_register_stock_code_check" CHECK (
  "stock_code" ~ '^LAX-(ORI|PRI)-[A-Z0-9]{1,6}-[A-Z0-9]{1,6}-[0-9]{2}-[0-9]{4}$'
  AND (("kind" = 'original') = ("stock_code" LIKE 'LAX-ORI-%'))
);

-- Rollback for 0362_artwork_register_zoho_price. Roll back the application release first: the
-- previous release neither reads nor writes this column. Zoho's price is read again on the next
-- sync once the migration is applied again.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "artwork_register" DROP COLUMN IF EXISTS "zoho_price";

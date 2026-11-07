-- Rollback for 0323_private_sale_deal_register_fk. Roll back the application release first: the
-- previous release reads the column as text. Every value is kept, as the id's text form.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
DROP INDEX IF EXISTS "private_sale_deal_artwork_register_idx";
--> statement-breakpoint
ALTER TABLE "private_sale_deal" DROP CONSTRAINT IF EXISTS "private_sale_deal_artwork_register_id_fk";
--> statement-breakpoint
ALTER TABLE "private_sale_deal"
  ALTER COLUMN "artwork_register_id" TYPE text USING "artwork_register_id"::text;

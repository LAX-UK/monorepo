-- Zoho's Status is compared before LAX writes it. The register now keeps the Status LAX last wrote
-- (apart from the Status Zoho last showed, which is a Zoho-owned copy), so a Sold or Reserved set
-- by staff is told apart from LAX's own value. A Status that LAX would have written over staff's
-- is raised as a conflict, so the conflict field check gains 'catalogueStatus'.
-- Additive: the column is nullable and the check only widens; existing rows already satisfy both.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "artwork_register" ADD COLUMN IF NOT EXISTS "catalogue_status_written" text;
--> statement-breakpoint
ALTER TABLE "artwork_register_conflict" DROP CONSTRAINT IF EXISTS "artwork_register_conflict_field_check";
--> statement-breakpoint
ALTER TABLE "artwork_register_conflict" ADD CONSTRAINT "artwork_register_conflict_field_check" CHECK (
  "field" IN ('stockCode', 'kind', 'sourceOriginalId', 'offerState', 'catalogueStatus')
);

-- Zoho's Status is compared before LAX writes it. The register now keeps the Status LAX last wrote
-- (apart from the Status Zoho last showed, which is a Zoho-owned copy), so a Sold or Reserved set
-- by staff is told apart from LAX's own value. A Status that LAX would have written over staff's
-- is raised as a conflict, so the conflict field check gains 'catalogueStatus'.
-- Backfill: a Status LAX wrote before this column existed was recorded as a zoho_writeback_recorded
-- event, so the latest such event per register seeds the column when its value is still the Status
-- Zoho shows. Without it that Status would read as a staff edit and raise a conflict. Only rows still
-- NULL are touched, so a re-run changes nothing.
-- The old recorder returned without an event when the inbound sync had already copied the value, so
-- a second seed covers the Statuses only LAX writes for a place that still holds: In Auction for a
-- bid sale and Withdrawn for a withdrawn artwork. Sold, Reserved and Available are not seeded from
-- the copy, since staff set those by hand too and LAX cannot tell whose they are.
-- Additive: the column is nullable and the check only widens; existing rows already satisfy both.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "artwork_register" ADD COLUMN IF NOT EXISTS "catalogue_status_written" text;
--> statement-breakpoint
UPDATE "artwork_register" AS r
SET "catalogue_status_written" = w."status"
FROM (
  SELECT DISTINCT ON ("register_id") "register_id", "payload"->>'to' AS "status"
  FROM "artwork_register_event"
  WHERE "type" = 'zoho_writeback_recorded' AND "payload"->>'field' = 'catalogueStatus'
  ORDER BY "register_id", "created_at" DESC, "id" DESC
) AS w
WHERE r."id" = w."register_id"
  AND r."catalogue_status_written" IS NULL
  AND r."catalogue_status" = w."status";
--> statement-breakpoint
UPDATE "artwork_register"
SET "catalogue_status_written" = "catalogue_status"
WHERE "catalogue_status_written" IS NULL
  AND (
    ("catalogue_status" = 'In Auction' AND "offer_state" = 'bid_sale')
    OR ("catalogue_status" = 'Withdrawn' AND "offer_state" = 'withdrawn')
  );
--> statement-breakpoint
ALTER TABLE "artwork_register_conflict" DROP CONSTRAINT IF EXISTS "artwork_register_conflict_field_check";
--> statement-breakpoint
ALTER TABLE "artwork_register_conflict" ADD CONSTRAINT "artwork_register_conflict_field_check" CHECK (
  "field" IN ('stockCode', 'kind', 'sourceOriginalId', 'offerState', 'catalogueStatus')
);

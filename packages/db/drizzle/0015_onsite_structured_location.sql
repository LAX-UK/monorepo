-- Structured onsite location fields. UK-friendly address breakdown is stored
-- alongside the existing free-form `location_address`, which remains as a
-- compatibility/fallback display string for already-saved onsite sales.
ALTER TABLE "sale" ADD COLUMN "location_address_line1" text;
ALTER TABLE "sale" ADD COLUMN "location_address_line2" text;
ALTER TABLE "sale" ADD COLUMN "location_city" text;
ALTER TABLE "sale" ADD COLUMN "location_county" text;
ALTER TABLE "sale" ADD COLUMN "location_postcode" text;
ALTER TABLE "sale" ADD COLUMN "location_country" text;

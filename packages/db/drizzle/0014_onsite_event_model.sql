-- Migrate existing hybrid sales to online (single-mode model: online vs onsite).
UPDATE "sale" SET "delivery_mode" = 'online' WHERE "delivery_mode" = 'hybrid';

-- Recreate the sale_delivery_mode enum without 'hybrid' while preserving existing data.
ALTER TABLE "sale" ALTER COLUMN "delivery_mode" DROP DEFAULT;
ALTER TABLE "sale" ALTER COLUMN "delivery_mode" TYPE text USING "delivery_mode"::text;
DROP TYPE "sale_delivery_mode";
CREATE TYPE "sale_delivery_mode" AS ENUM ('online', 'onsite');
ALTER TABLE "sale"
  ALTER COLUMN "delivery_mode" TYPE "sale_delivery_mode"
  USING "delivery_mode"::"sale_delivery_mode";
ALTER TABLE "sale" ALTER COLUMN "delivery_mode" SET DEFAULT 'onsite';

-- Onsite event location (optional, public-facing).
ALTER TABLE "sale" ADD COLUMN "location_name" text;
ALTER TABLE "sale" ADD COLUMN "location_address" text;
ALTER TABLE "sale" ADD COLUMN "location_map_url" text;

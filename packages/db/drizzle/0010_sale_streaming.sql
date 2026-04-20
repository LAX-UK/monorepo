CREATE TYPE "sale_delivery_mode" AS ENUM ('online', 'onsite', 'hybrid');
ALTER TABLE "sale" ADD COLUMN "delivery_mode" "sale_delivery_mode" DEFAULT 'onsite' NOT NULL;
ALTER TABLE "sale" ADD COLUMN "stream_url" text;

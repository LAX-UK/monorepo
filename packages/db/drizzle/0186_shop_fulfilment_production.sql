CREATE TYPE "shop_fulfilment_status" AS ENUM(
  'pending_production',
  'in_production',
  'awaiting_dispatch',
  'in_transit',
  'ready_for_collection',
  'collected',
  'in_storage',
  'delivered',
  'cancelled'
);
--> statement-breakpoint
CREATE TYPE "shop_production_task_status" AS ENUM(
  'queued',
  'printing',
  'qc_pending',
  'qc_failed',
  'qc_passed',
  'completed',
  'cancelled'
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_fulfilment_option_price" (
  "option" "shop_fulfilment_option" PRIMARY KEY NOT NULL,
  "price_pence" integer NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "shop_fulfilment_option_price_nonnegative" CHECK ("price_pence" >= 0)
);
--> statement-breakpoint
INSERT INTO "shop_fulfilment_option_price" ("option", "price_pence")
VALUES
  ('uk_insured_delivery', 1500),
  ('lax_storage', 500),
  ('collect_new_cavendish', 0),
  ('collect_brunswick', 0),
  ('international_quotation', 0)
ON CONFLICT ("option") DO NOTHING;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_fulfilment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL REFERENCES "shop_order"("id") ON DELETE restrict,
  "option" "shop_fulfilment_option" NOT NULL,
  "status" "shop_fulfilment_status" DEFAULT 'pending_production' NOT NULL,
  "carrier" text,
  "tracking_number" text,
  "possession_at" timestamp with time zone,
  "storage_location" text,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_fulfilment_order_uid" ON "shop_fulfilment" ("order_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_production_task" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_line_id" uuid NOT NULL REFERENCES "shop_order_line"("id") ON DELETE restrict,
  "edition_id" uuid NOT NULL REFERENCES "shop_edition"("id") ON DELETE restrict,
  "status" "shop_production_task_status" DEFAULT 'queued' NOT NULL,
  "assigned_to_subject_id" text,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_production_task_order_line_uid" ON "shop_production_task" ("order_line_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_certificate" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "edition_id" uuid NOT NULL REFERENCES "shop_edition"("id") ON DELETE restrict,
  "order_line_id" uuid REFERENCES "shop_order_line"("id") ON DELETE set null,
  "document_id" uuid REFERENCES "shop_document"("id") ON DELETE set null,
  "issued_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_certificate_edition_uid" ON "shop_certificate" ("edition_id");

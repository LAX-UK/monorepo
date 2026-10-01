CREATE TYPE "shop_stock_hold_status" AS ENUM('active', 'released', 'expired', 'converted');
--> statement-breakpoint
CREATE TYPE "shop_third_party_sale_status" AS ENUM('draft', 'recorded', 'cancelled');
--> statement-breakpoint
CREATE TYPE "shop_sale_fee_status" AS ENUM('pending', 'approved', 'rejected');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_stock_hold" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "edition_id" uuid NOT NULL REFERENCES "shop_edition"("id") ON DELETE restrict,
  "broker_party_id" uuid NOT NULL REFERENCES "shop_party"("id") ON DELETE restrict,
  "client_party_id" uuid NOT NULL REFERENCES "shop_party"("id") ON DELETE restrict,
  "status" "shop_stock_hold_status" DEFAULT 'active' NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "note" text,
  "created_by_subject_id" text NOT NULL,
  "released_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_stock_hold_edition_active_idx"
  ON "shop_stock_hold" ("edition_id", "status")
  WHERE "status" = 'active';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_third_party_sale" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "edition_id" uuid NOT NULL REFERENCES "shop_edition"("id") ON DELETE restrict,
  "seller_party_id" uuid NOT NULL REFERENCES "shop_party"("id") ON DELETE restrict,
  "buyer_party_id" uuid NOT NULL REFERENCES "shop_party"("id") ON DELETE restrict,
  "broker_party_id" uuid REFERENCES "shop_party"("id") ON DELETE set null,
  "gross_pence" integer NOT NULL,
  "status" "shop_third_party_sale_status" DEFAULT 'draft' NOT NULL,
  "recorded_by_subject_id" text NOT NULL,
  "recorded_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "shop_third_party_sale_gross_nonnegative" CHECK ("gross_pence" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_sale_fee" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "third_party_sale_id" uuid NOT NULL REFERENCES "shop_third_party_sale"("id") ON DELETE restrict,
  "label" text NOT NULL,
  "amount_pence" integer NOT NULL,
  "vat_treatment" text,
  "vat_rate_bp" integer,
  "vat_pence" integer,
  "status" "shop_sale_fee_status" DEFAULT 'pending' NOT NULL,
  "approved_by_subject_id" text,
  "approved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "shop_sale_fee_amount_nonnegative" CHECK ("amount_pence" >= 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_sale_fee_sale_idx" ON "shop_sale_fee" ("third_party_sale_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_client_assignment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_party_id" uuid NOT NULL REFERENCES "shop_party"("id") ON DELETE restrict,
  "broker_subject_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_client_assignment_client_broker_uid"
  ON "shop_client_assignment" ("client_party_id", "broker_subject_id");

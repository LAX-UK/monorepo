CREATE TYPE "shop_sale_authority_request_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_sale_authority_grant" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "artwork_id" uuid NOT NULL REFERENCES "shop_artwork"("id") ON DELETE restrict,
  "owner_party_id" uuid NOT NULL REFERENCES "shop_party"("id") ON DELETE restrict,
  "authorised_count" integer NOT NULL,
  "recorded_by_subject_id" text NOT NULL,
  "evidence_note" text NOT NULL,
  "request_id" uuid,
  "revision" bigserial NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "shop_sale_authority_grant_count_range" CHECK ("authorised_count" >= 0 AND "authorised_count" <= 10)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_sale_authority_request" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "artwork_id" uuid NOT NULL REFERENCES "shop_artwork"("id") ON DELETE restrict,
  "owner_party_id" uuid NOT NULL REFERENCES "shop_party"("id") ON DELETE restrict,
  "requested_count" integer NOT NULL,
  "note" text,
  "status" "shop_sale_authority_request_status" DEFAULT 'pending' NOT NULL,
  "handled_by_subject_id" text,
  "handled_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "shop_sale_authority_request_count_range" CHECK ("requested_count" >= 0 AND "requested_count" <= 10)
);

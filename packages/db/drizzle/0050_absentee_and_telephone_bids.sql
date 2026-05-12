CREATE TYPE "absentee_bid_status" AS ENUM (
  'scheduled',
  'executing',
  'executed',
  'lost',
  'cancelled',
  'voided'
);

CREATE TABLE "absentee_bid" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lot_id" uuid NOT NULL REFERENCES "lot"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "buyer_legal_entity_id" uuid NOT NULL REFERENCES "legal_entity"("id") ON DELETE RESTRICT,
  "max_amount" numeric(18, 2) NOT NULL,
  "status" "absentee_bid_status" NOT NULL DEFAULT 'scheduled',
  "executed_bid_id" uuid REFERENCES "bid"("id") ON DELETE SET NULL,
  "placed_at" timestamptz NOT NULL DEFAULT now(),
  "cancelled_at" timestamptz,
  "cancellation_reason" text
);

CREATE UNIQUE INDEX "absentee_bid_lot_user_entity_scheduled_uidx" ON "absentee_bid" ("lot_id", "user_id", "buyer_legal_entity_id")
  WHERE "status" = 'scheduled';

CREATE INDEX "absentee_bid_lot_status_idx" ON "absentee_bid" ("lot_id", "status") WHERE "status" = 'scheduled';

CREATE TYPE "telephone_bid_booking_status" AS ENUM (
  'requested',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled'
);

CREATE TABLE "telephone_bid_booking" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sale_id" uuid NOT NULL REFERENCES "sale"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "buyer_legal_entity_id" uuid NOT NULL REFERENCES "legal_entity"("id") ON DELETE RESTRICT,
  "phone_e164" text NOT NULL,
  "lot_ids" uuid[] NOT NULL DEFAULT '{}',
  "reserve_alt_max" numeric(18, 2),
  "status" "telephone_bid_booking_status" NOT NULL DEFAULT 'requested',
  "clerk_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "confirmed_at" timestamptz
);

CREATE INDEX "telephone_bid_booking_sale_idx" ON "telephone_bid_booking" ("sale_id");

ALTER TABLE "bid" ADD COLUMN "placed_via" text;
ALTER TABLE "bid" ADD COLUMN "telephone_booking_id" uuid REFERENCES "telephone_bid_booking"("id") ON DELETE SET NULL;

COMMENT ON COLUMN "bid"."placed_via" IS 'e.g. web, absentee, telephone, saleroom';

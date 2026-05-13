CREATE TYPE "lot_fulfilment_status" AS ENUM (
  'awaiting_payment',
  'awaiting_release',
  'released',
  'ready_for_collection',
  'in_transit',
  'delivered',
  'cancelled'
);

CREATE TYPE "lot_fulfilment_method" AS ENUM ('collection', 'shipping');

CREATE TABLE "lot_fulfilment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lot_id" uuid NOT NULL UNIQUE REFERENCES "lot"("id") ON DELETE CASCADE,
  "payment_id" uuid REFERENCES "payment"("id") ON DELETE SET NULL,
  "status" "lot_fulfilment_status" NOT NULL DEFAULT 'awaiting_payment',
  "release_approved_by_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "release_approved_at" timestamptz,
  "fulfilment_method" "lot_fulfilment_method",
  "shipping_carrier" text,
  "tracking_number" text,
  "collected_by" text,
  "collected_at" timestamptz,
  "address_snapshot" jsonb,
  "notes" text,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "lot_fulfilment_status_updated_idx" ON "lot_fulfilment" ("status", "updated_at");

ALTER TABLE "item_submission" ADD COLUMN "assigned_to_user_id" text REFERENCES "user"("id") ON DELETE SET NULL;

CREATE INDEX "item_submission_assigned_to_idx" ON "item_submission" ("assigned_to_user_id") WHERE "assigned_to_user_id" IS NOT NULL;

CREATE TABLE "lot_document" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lot_id" uuid NOT NULL REFERENCES "lot"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "label" text,
  "upload_object_id" uuid NOT NULL REFERENCES "upload_object"("id") ON DELETE RESTRICT,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "lot_document_lot_id_idx" ON "lot_document" ("lot_id");

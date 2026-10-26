-- Orders get a readable reference ("LAX-S-10482") that shoppers, emails, invoices, Stripe and staff
-- all quote. The database issues it from a sequence, once, when the order row is inserted, so an
-- older shop-api that does not know the column still creates orders with one. Existing orders are
-- numbered in the order they were created.
-- Fulfilment records when each stage was reached, for the order timeline. Stages reached before
-- this migration take their date from the staff audit trail where it holds one.
-- Problem reports sent from an order page reach the staff enquiry inbox under their own topic.
-- Paid orders get an invoice number ("LAX-INV-000124") from a gap-free counter: a trigger takes
-- the next number in the same transaction that sets paid_at, so a payment that rolls back gives
-- its number back and two payments can never share one. Paid orders are numbered in payment order.
-- VAT stored on order lines was 20% of the VAT-inclusive price; it is recomputed from the stored
-- rate as the VAT the price includes, and orders record the VAT in their delivery charge.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS "shop_order_reference_seq" START WITH 10001 MINVALUE 10000;
--> statement-breakpoint
ALTER TABLE "shop_order" ADD COLUMN IF NOT EXISTS "reference" text;
--> statement-breakpoint
WITH numbered AS (
  SELECT "id", row_number() OVER (ORDER BY "created_at", "id") AS position
  FROM "shop_order"
  WHERE "reference" IS NULL
), base AS (
  SELECT COALESCE(MAX(substring("reference" FROM 7)::bigint), 10000) AS last_number
  FROM "shop_order"
  WHERE "reference" ~ '^LAX-S-[0-9]+$'
)
UPDATE "shop_order" AS o
SET "reference" = 'LAX-S-' || (base.last_number + numbered.position)::text
FROM numbered, base
WHERE o."id" = numbered."id";
--> statement-breakpoint
SELECT setval(
  'shop_order_reference_seq',
  (
    SELECT COALESCE(MAX(substring("reference" FROM 7)::bigint), 10000)
    FROM "shop_order"
    WHERE "reference" ~ '^LAX-S-[0-9]+$'
  )
);
--> statement-breakpoint
ALTER TABLE "shop_order" ALTER COLUMN "reference" SET DEFAULT ('LAX-S-' || nextval('shop_order_reference_seq')::text);
--> statement-breakpoint
ALTER TABLE "shop_order" ALTER COLUMN "reference" SET NOT NULL;
--> statement-breakpoint
ALTER SEQUENCE "shop_order_reference_seq" OWNED BY "shop_order"."reference";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_order_reference_uid" ON "shop_order" USING btree ("reference");
--> statement-breakpoint
ALTER TABLE "shop_fulfilment" ADD COLUMN IF NOT EXISTS "production_started_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "shop_fulfilment" ADD COLUMN IF NOT EXISTS "dispatched_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "shop_fulfilment" ADD COLUMN IF NOT EXISTS "ready_for_collection_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "shop_fulfilment" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp with time zone;
--> statement-breakpoint
WITH stages AS (
  SELECT
    "target_id",
    MIN("created_at") FILTER (WHERE "after_json" LIKE '%"status":"in_production"%') AS production_started_at,
    MIN("created_at") FILTER (WHERE "after_json" LIKE '%"status":"in_transit"%') AS dispatched_at,
    MIN("created_at") FILTER (WHERE "after_json" LIKE '%"status":"ready_for_collection"%') AS ready_for_collection_at,
    MIN("created_at") FILTER (WHERE "after_json" LIKE '%"status":"cancelled"%') AS cancelled_at
  FROM "shop_admin_audit"
  WHERE "target_type" = 'shop_fulfilment' AND "action" IN ('update_fulfilment', 'record_possession')
  GROUP BY "target_id"
)
UPDATE "shop_fulfilment" AS f
SET
  "production_started_at" = COALESCE(f."production_started_at", stages.production_started_at),
  "dispatched_at" = COALESCE(f."dispatched_at", stages.dispatched_at),
  "ready_for_collection_at" = COALESCE(f."ready_for_collection_at", stages.ready_for_collection_at),
  "cancelled_at" = COALESCE(f."cancelled_at", stages.cancelled_at)
FROM stages
WHERE stages."target_id" = f."id"::text;
--> statement-breakpoint
ALTER TYPE "public"."shop_general_enquiry_topic" ADD VALUE IF NOT EXISTS 'order_problem';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_invoice_counter" (
  "id" smallint PRIMARY KEY DEFAULT 1 CONSTRAINT "shop_invoice_counter_single_row_ck" CHECK ("id" = 1),
  "last_number" integer DEFAULT 0 NOT NULL CONSTRAINT "shop_invoice_counter_nonnegative_ck" CHECK ("last_number" >= 0)
);
--> statement-breakpoint
INSERT INTO "shop_invoice_counter" ("id", "last_number") VALUES (1, 0) ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "shop_order" ADD COLUMN IF NOT EXISTS "invoice_number" text;
--> statement-breakpoint
WITH numbered AS (
  SELECT "id", row_number() OVER (ORDER BY "paid_at", "id") AS position
  FROM "shop_order"
  WHERE "paid_at" IS NOT NULL AND "invoice_number" IS NULL
), base AS (
  SELECT "last_number" FROM "shop_invoice_counter" WHERE "id" = 1
)
UPDATE "shop_order" AS o
SET "invoice_number" = 'LAX-INV-' || lpad((base.last_number + numbered.position)::text, 6, '0')
FROM numbered, base
WHERE o."id" = numbered."id";
--> statement-breakpoint
UPDATE "shop_invoice_counter"
SET "last_number" = (
  SELECT COALESCE(MAX(substring("invoice_number" FROM 9)::integer), 0)
  FROM "shop_order"
  WHERE "invoice_number" ~ '^LAX-INV-[0-9]+$'
)
WHERE "id" = 1;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_order_invoice_number_uid" ON "shop_order" USING btree ("invoice_number");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "shop_order_assign_invoice_number"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  next_number integer;
BEGIN
  IF NEW."paid_at" IS NOT NULL AND NEW."invoice_number" IS NULL THEN
    -- The row lock on the counter queues concurrent payments; a rollback returns the number.
    UPDATE "shop_invoice_counter" SET "last_number" = "last_number" + 1 WHERE "id" = 1
    RETURNING "last_number" INTO next_number;
    IF next_number IS NULL THEN
      RAISE EXCEPTION 'shop_invoice_counter has no row';
    END IF;
    NEW."invoice_number" := 'LAX-INV-' || lpad(next_number::text, 6, '0');
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "shop_order_invoice_number_trg" ON "shop_order";
--> statement-breakpoint
CREATE TRIGGER "shop_order_invoice_number_trg"
BEFORE INSERT OR UPDATE OF "paid_at" ON "shop_order"
FOR EACH ROW EXECUTE FUNCTION "shop_order_assign_invoice_number"();
--> statement-breakpoint
UPDATE "shop_order_line"
SET "vat_pence" = round("unit_price_pence"::numeric * "vat_rate_bp" / (10000 + "vat_rate_bp"))::integer
WHERE "vat_rate_bp" > 0;
--> statement-breakpoint
ALTER TABLE "shop_order" ADD COLUMN IF NOT EXISTS "fulfilment_vat_pence" integer;
--> statement-breakpoint
WITH rates AS (
  SELECT "order_id", MIN("vat_rate_bp") AS rate
  FROM "shop_order_line"
  GROUP BY "order_id"
  HAVING COUNT(*) = COUNT("vat_rate_bp") AND MIN("vat_rate_bp") = MAX("vat_rate_bp") AND MIN("vat_rate_bp") > 0
)
UPDATE "shop_order" AS o
SET "fulfilment_vat_pence" = round(o."fulfilment_surcharge_pence"::numeric * rates.rate / (10000 + rates.rate))::integer
FROM rates
WHERE rates."order_id" = o."id" AND o."fulfilment_vat_pence" IS NULL;

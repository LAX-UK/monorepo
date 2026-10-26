-- Orders get a readable reference ("LAX-S-10482") that shoppers, emails, invoices, Stripe and staff
-- all quote. The database issues it from a sequence, once, when the order row is inserted, so an
-- older shop-api that does not know the column still creates orders with one. Existing orders are
-- numbered in the order they were created.
-- Fulfilment records when each stage was reached, for the order timeline. Stages reached before
-- this migration take their date from the staff audit trail where it holds one.
-- Problem reports sent from an order page reach the staff enquiry inbox under their own topic.
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

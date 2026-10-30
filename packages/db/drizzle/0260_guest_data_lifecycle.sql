-- Enquiries get a readable reference ("E-2041") from one sequence shared by artwork enquiries and
-- general enquiries, so the sender, the acknowledgement email and staff quote the same thing.
-- Existing enquiries are numbered in the order they were sent.
-- A guest lead now also comes from an enquiry: the lead records where it started, whether the
-- person reached checkout, and how many enquiries they sent. Existing guest enquiries become leads.
-- A guest's personal data can be erased on request: the lead and the guest's orders record when,
-- and when the invoice name and address kept for the accounting record were purged.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS "shop_enquiry_reference_seq" START WITH 2001 MINVALUE 2000;
--> statement-breakpoint
ALTER TABLE "shop_general_enquiry" ADD COLUMN IF NOT EXISTS "reference" text;
--> statement-breakpoint
ALTER TABLE "shop_artwork_interest" ADD COLUMN IF NOT EXISTS "reference" text;
--> statement-breakpoint
WITH enquiries AS (
  SELECT 'general' AS kind, "id", "created_at" FROM "shop_general_enquiry" WHERE "reference" IS NULL
  UNION ALL
  SELECT 'artwork' AS kind, "id", "created_at" FROM "shop_artwork_interest"
  WHERE "intent" = 'enquiry' AND "reference" IS NULL
), numbered AS (
  SELECT kind, "id", 2000 + row_number() OVER (ORDER BY "created_at", "id") AS position
  FROM enquiries
)
UPDATE "shop_general_enquiry" AS g
SET "reference" = 'E-' || numbered.position::text
FROM numbered
WHERE numbered.kind = 'general' AND g."id" = numbered."id";
--> statement-breakpoint
WITH enquiries AS (
  SELECT 'general' AS kind, "id", "created_at" FROM "shop_general_enquiry"
  UNION ALL
  SELECT 'artwork' AS kind, "id", "created_at" FROM "shop_artwork_interest"
  WHERE "intent" = 'enquiry'
), numbered AS (
  SELECT kind, "id", 2000 + row_number() OVER (ORDER BY "created_at", "id") AS position
  FROM enquiries
)
UPDATE "shop_artwork_interest" AS a
SET "reference" = 'E-' || numbered.position::text
FROM numbered
WHERE numbered.kind = 'artwork' AND a."id" = numbered."id" AND a."reference" IS NULL;
--> statement-breakpoint
SELECT setval(
  'shop_enquiry_reference_seq',
  GREATEST(
    2000,
    (SELECT COALESCE(MAX(substring("reference" FROM 3)::bigint), 2000) FROM "shop_general_enquiry"
      WHERE "reference" ~ '^E-[0-9]+$'),
    (SELECT COALESCE(MAX(substring("reference" FROM 3)::bigint), 2000) FROM "shop_artwork_interest"
      WHERE "reference" ~ '^E-[0-9]+$')
  )
);
--> statement-breakpoint
ALTER TABLE "shop_general_enquiry" ALTER COLUMN "reference" SET DEFAULT ('E-' || nextval('shop_enquiry_reference_seq')::text);
--> statement-breakpoint
ALTER TABLE "shop_general_enquiry" ALTER COLUMN "reference" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_general_enquiry_reference_uid" ON "shop_general_enquiry" ("reference");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_artwork_interest_reference_uid" ON "shop_artwork_interest" ("reference")
  WHERE "reference" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "shop_artwork_interest" ADD CONSTRAINT "shop_artwork_interest_reference_ck"
  CHECK (("intent" = 'enquiry') = ("reference" IS NOT NULL));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_artwork_interest_guest_email_idx"
  ON "shop_artwork_interest" (lower("contact_email"))
  WHERE "identity_subject_id" IS NULL AND "intent" = 'enquiry';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_general_enquiry_guest_email_idx"
  ON "shop_general_enquiry" (lower("contact_email"))
  WHERE "identity_subject_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "shop_guest_customer" ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'shop_checkout' NOT NULL;
--> statement-breakpoint
ALTER TABLE "shop_guest_customer" ADD CONSTRAINT "shop_guest_customer_source_ck"
  CHECK ("source" IN ('shop_checkout', 'shop_enquiry', 'art_enquiry'));
--> statement-breakpoint
ALTER TABLE "shop_guest_customer" ADD COLUMN IF NOT EXISTS "checkout_started_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "shop_guest_customer" SET "checkout_started_at" = "first_seen_at" WHERE "checkout_started_at" IS NULL;
--> statement-breakpoint
ALTER TABLE "shop_guest_customer" ADD COLUMN IF NOT EXISTS "enquiry_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "shop_guest_customer" ADD COLUMN IF NOT EXISTS "last_enquiry_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "shop_guest_customer" ADD CONSTRAINT "shop_guest_customer_enquiry_count_ck"
  CHECK ("enquiry_count" >= 0);
--> statement-breakpoint
ALTER TABLE "shop_guest_customer" ADD COLUMN IF NOT EXISTS "erased_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "shop_guest_customer" ADD COLUMN IF NOT EXISTS "erased_by_subject_id" text;
--> statement-breakpoint
ALTER TABLE "shop_guest_customer" ADD CONSTRAINT "shop_guest_customer_erasure_pair_ck"
  CHECK (("erased_at" IS NULL) = ("erased_by_subject_id" IS NULL));
--> statement-breakpoint
ALTER TABLE "shop_order" ADD COLUMN IF NOT EXISTS "personal_data_erased_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "shop_order" ADD COLUMN IF NOT EXISTS "invoice_data_purged_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_order_invoice_purge_due_idx" ON "shop_order" ("personal_data_erased_at")
  WHERE "personal_data_erased_at" IS NOT NULL AND "invoice_data_purged_at" IS NULL;
--> statement-breakpoint
WITH guest_enquiries AS (
  SELECT lower(btrim(i."contact_email")) AS email, i."contact_name" AS name, i."contact_phone" AS phone,
    i."created_at", w."sales_channel"::text AS channel
  FROM "shop_artwork_interest" i
  JOIN "shop_artwork" w ON w."id" = i."artwork_id"
  WHERE i."identity_subject_id" IS NULL AND i."intent" = 'enquiry' AND i."contact_email" IS NOT NULL
  UNION ALL
  SELECT lower(btrim("contact_email")), "contact_name", "phone", "created_at", 'art'
  FROM "shop_general_enquiry"
  WHERE "identity_subject_id" IS NULL AND "contact_email" IS NOT NULL AND "topic" <> 'order_problem'
), per_email AS (
  SELECT email,
    (array_agg(name ORDER BY "created_at" DESC) FILTER (WHERE name IS NOT NULL))[1] AS name,
    (array_agg(phone ORDER BY "created_at" DESC) FILTER (WHERE phone IS NOT NULL))[1] AS phone,
    (array_agg(channel ORDER BY "created_at"))[1] AS first_channel,
    MIN("created_at") AS first_seen, MAX("created_at") AS last_seen, COUNT(*)::int AS enquiries
  FROM guest_enquiries
  WHERE email <> ''
  GROUP BY email
)
INSERT INTO "shop_guest_customer"
  ("email", "name", "phone", "source", "first_seen_at", "last_seen_at", "enquiry_count", "last_enquiry_at")
SELECT email, name, phone, first_channel || '_enquiry', first_seen, last_seen, enquiries, last_seen
FROM per_email
ON CONFLICT ("email") DO UPDATE SET
  "enquiry_count" = EXCLUDED."enquiry_count",
  "last_enquiry_at" = EXCLUDED."last_enquiry_at",
  "first_seen_at" = LEAST("shop_guest_customer"."first_seen_at", EXCLUDED."first_seen_at"),
  "last_seen_at" = GREATEST("shop_guest_customer"."last_seen_at", EXCLUDED."last_seen_at");

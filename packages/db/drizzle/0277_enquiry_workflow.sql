-- Enquiries become a worked record: a reference to quote, an intent, a wider status, an owner,
-- notes and replies, a private sale detail, and routing from department to specialist.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS "marketing_enquiry_reference_seq" START WITH 1001 MINVALUE 1000;
--> statement-breakpoint
ALTER TABLE "marketing_enquiry" ADD COLUMN IF NOT EXISTS "reference" text;
--> statement-breakpoint
-- Existing enquiries are numbered in the order they arrived, from E-1001.
WITH ordered AS (
  SELECT id, 1000 + row_number() OVER (ORDER BY created_at, id) AS n
  FROM "marketing_enquiry"
  WHERE "reference" IS NULL
)
UPDATE "marketing_enquiry" AS e
SET "reference" = 'E-' || ordered.n
FROM ordered
WHERE e.id = ordered.id;
--> statement-breakpoint
SELECT setval(
  'marketing_enquiry_reference_seq',
  GREATEST(
    (SELECT COALESCE(max(substring("reference" from 3)::bigint), 1000) FROM "marketing_enquiry"),
    1000
  )
);
--> statement-breakpoint
ALTER TABLE "marketing_enquiry"
  ALTER COLUMN "reference" SET DEFAULT ('E-' || nextval('marketing_enquiry_reference_seq')::text);
--> statement-breakpoint
ALTER TABLE "marketing_enquiry" ALTER COLUMN "reference" SET NOT NULL;
--> statement-breakpoint
ALTER SEQUENCE "marketing_enquiry_reference_seq" OWNED BY "marketing_enquiry"."reference";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "marketing_enquiry_reference_uidx"
  ON "marketing_enquiry" ("reference");
--> statement-breakpoint
ALTER TABLE "marketing_enquiry"
  ADD COLUMN IF NOT EXISTS "intent" text DEFAULT 'general' NOT NULL,
  ADD COLUMN IF NOT EXISTS "close_reason" text,
  ADD COLUMN IF NOT EXISTS "assigned_to_user_id" text,
  ADD COLUMN IF NOT EXISTS "department_slug" text,
  ADD COLUMN IF NOT EXISTS "user_id" text,
  ADD COLUMN IF NOT EXISTS "legal_entity_id" uuid,
  ADD COLUMN IF NOT EXISTS "marketing_opt_in" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
-- The enquiry page used to open a private sale message with a tag; the topic says which way.
UPDATE "marketing_enquiry"
SET "intent" = CASE
  WHEN "message" LIKE 'Private sale enquiry%' AND "topic" = 'selling' THEN 'private_sale_sell'
  WHEN "message" LIKE 'Private sale enquiry%' THEN 'private_sale_buy'
  WHEN "topic" = 'other' THEN 'general'
  ELSE "topic"
END;
--> statement-breakpoint
ALTER TABLE "marketing_enquiry" DROP CONSTRAINT IF EXISTS "marketing_enquiry_status_check";
--> statement-breakpoint
ALTER TABLE "marketing_enquiry" DROP CONSTRAINT IF EXISTS "marketing_enquiry_handled_check";
--> statement-breakpoint
-- A handled enquiry is a closed one.
UPDATE "marketing_enquiry" SET "status" = 'closed' WHERE "status" = 'handled';
--> statement-breakpoint
ALTER TABLE "marketing_enquiry"
  ADD CONSTRAINT "marketing_enquiry_status_check"
    CHECK ("status" IN ('new', 'in_progress', 'waiting_on_client', 'converted', 'closed')),
  ADD CONSTRAINT "marketing_enquiry_handled_check"
    CHECK (("status" = 'closed') = ("handled_at" IS NOT NULL)),
  ADD CONSTRAINT "marketing_enquiry_close_reason_check"
    CHECK (
      "close_reason" IS NULL
      OR ("status" = 'closed'
        AND "close_reason" IN ('not_a_fit', 'not_proceeding', 'sold_elsewhere', 'duplicate', 'spam'))
    ),
  ADD CONSTRAINT "marketing_enquiry_intent_check"
    CHECK (
      "intent" IN (
        'general', 'private_sale_sell', 'private_sale_buy', 'buying', 'selling', 'shipping', 'press'
      )
    ),
  ADD CONSTRAINT "marketing_enquiry_version_check" CHECK ("version" >= 1),
  ADD CONSTRAINT "marketing_enquiry_assigned_to_user_id_user_id_fk"
    FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."user"("id") ON DELETE set null,
  ADD CONSTRAINT "marketing_enquiry_user_id_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null,
  ADD CONSTRAINT "marketing_enquiry_legal_entity_id_legal_entity_id_fk"
    FOREIGN KEY ("legal_entity_id") REFERENCES "public"."legal_entity"("id") ON DELETE set null;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketing_enquiry_open_created_idx"
  ON "marketing_enquiry" ("created_at", "id")
  WHERE "status" IN ('new', 'in_progress', 'waiting_on_client');
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketing_enquiry_assignee_idx"
  ON "marketing_enquiry" ("assigned_to_user_id", "status")
  WHERE "assigned_to_user_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketing_enquiry_intent_created_idx"
  ON "marketing_enquiry" ("intent", "created_at", "id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "private_sale_enquiry_detail" (
  "enquiry_id" uuid PRIMARY KEY NOT NULL,
  "artist" text,
  "title" text,
  "medium" text,
  "size" text,
  "location_town" text,
  "location_country" text,
  "price_in_mind_minor" bigint,
  "looking_for" text,
  "budget_band" text,
  "timing" text,
  "contact_preference" text DEFAULT 'email' NOT NULL,
  CONSTRAINT "private_sale_enquiry_detail_enquiry_id_fk"
    FOREIGN KEY ("enquiry_id") REFERENCES "marketing_enquiry"("id") ON DELETE cascade,
  CONSTRAINT "private_sale_enquiry_detail_price_check"
    CHECK ("price_in_mind_minor" IS NULL OR "price_in_mind_minor" > 0),
  CONSTRAINT "private_sale_enquiry_detail_budget_band_check"
    CHECK (
      "budget_band" IS NULL OR "budget_band" IN (
        'under_10000', '10000_to_50000', '50000_to_250000', 'over_250000', 'prefer_not_to_say'
      )
    ),
  CONSTRAINT "private_sale_enquiry_detail_timing_check"
    CHECK ("timing" IS NULL OR "timing" IN ('no_rush', 'within_3_months', 'urgent')),
  CONSTRAINT "private_sale_enquiry_detail_contact_preference_check"
    CHECK ("contact_preference" IN ('email', 'phone', 'either'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "marketing_enquiry_attachment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "enquiry_id" uuid NOT NULL,
  "upload_object_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "position" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "marketing_enquiry_attachment_enquiry_id_fk"
    FOREIGN KEY ("enquiry_id") REFERENCES "marketing_enquiry"("id") ON DELETE cascade,
  CONSTRAINT "marketing_enquiry_attachment_upload_object_id_fk"
    FOREIGN KEY ("upload_object_id") REFERENCES "upload_object"("id") ON DELETE cascade,
  CONSTRAINT "marketing_enquiry_attachment_kind_check" CHECK ("kind" IN ('image', 'document')),
  CONSTRAINT "marketing_enquiry_attachment_position_check" CHECK ("position" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "marketing_enquiry_attachment_position_uidx"
  ON "marketing_enquiry_attachment" ("enquiry_id", "kind", "position");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "marketing_enquiry_attachment_upload_uidx"
  ON "marketing_enquiry_attachment" ("upload_object_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "marketing_enquiry_note" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "enquiry_id" uuid NOT NULL,
  "author_user_id" text,
  "body" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "marketing_enquiry_note_enquiry_id_fk"
    FOREIGN KEY ("enquiry_id") REFERENCES "marketing_enquiry"("id") ON DELETE cascade,
  CONSTRAINT "marketing_enquiry_note_author_user_id_user_id_fk"
    FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE set null,
  CONSTRAINT "marketing_enquiry_note_body_check"
    CHECK (char_length("body") BETWEEN 1 AND 5000)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketing_enquiry_note_enquiry_idx"
  ON "marketing_enquiry_note" ("enquiry_id", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "marketing_enquiry_message" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "enquiry_id" uuid NOT NULL,
  "sent_by_user_id" text,
  "subject" text NOT NULL,
  "body" text NOT NULL,
  "outbox_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "marketing_enquiry_message_enquiry_id_fk"
    FOREIGN KEY ("enquiry_id") REFERENCES "marketing_enquiry"("id") ON DELETE cascade,
  CONSTRAINT "marketing_enquiry_message_sent_by_user_id_user_id_fk"
    FOREIGN KEY ("sent_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketing_enquiry_message_enquiry_idx"
  ON "marketing_enquiry_message" ("enquiry_id", "created_at");
--> statement-breakpoint
-- One row per department, plus one row with no department as the fallback.
CREATE TABLE IF NOT EXISTS "enquiry_routing_rule" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "department_slug" text,
  "assigned_to_user_id" text NOT NULL,
  "updated_by_user_id" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "enquiry_routing_rule_assigned_to_user_id_user_id_fk"
    FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."user"("id") ON DELETE cascade,
  CONSTRAINT "enquiry_routing_rule_updated_by_user_id_user_id_fk"
    FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enquiry_routing_rule_department_uidx"
  ON "enquiry_routing_rule" ("department_slug")
  WHERE "department_slug" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enquiry_routing_rule_fallback_uidx"
  ON "enquiry_routing_rule" ((true))
  WHERE "department_slug" IS NULL;

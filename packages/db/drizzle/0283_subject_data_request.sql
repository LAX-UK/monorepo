-- Staff's "Data requests" screen: Identity owns the requests staff log and answer by hand, next
-- to the automatic downloads in subject_data_export.
--   subject_data_request: one row per manual request, with its London-dated clock (null while
--     waiting for proof of identity), an Article 12(3) extension recorded once, the outcome, and
--     an optional link to the automatic download it continues (one download is continued once).
--   subject_data_request_audit: append-only record of what staff did (ids, dates and codes;
--     never notes or contact details).
-- The request keeps its record if the user row or the linked download is ever deleted (the
-- foreign keys set the column to null). The contact fields are cleared by the retention job some
-- time after the request closes; the dates, scope and outcome stay.
-- Additive: a sequence and two new tables, so the running services keep working until they restart.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS "subject_data_request_reference_seq" AS bigint MINVALUE 1 START WITH 1;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subject_data_request" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "reference" text DEFAULT ('DR-' || lpad(nextval('subject_data_request_reference_seq')::text, 4, '0')) NOT NULL,
  "subject_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "contact_name" text,
  "contact_detail" text,
  "contact_cleared_at" timestamp with time zone,
  "reason" text NOT NULL,
  "channel" text NOT NULL,
  "products" text[] NOT NULL,
  "product_gathered" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "received_on" date NOT NULL,
  "clock_started_on" date,
  "due_on" date,
  "extended_due_on" date,
  "extension_reason" text,
  "extension_note" text,
  "person_told_on" date,
  "person_told_via" text,
  "status" text NOT NULL,
  "outcome" text,
  "outcome_note" text,
  "complaint_right_told" boolean,
  "closed_on" date,
  "closed_by" text,
  "linked_export_id" uuid REFERENCES "subject_data_export"("id") ON DELETE SET NULL,
  "notes" text,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  CONSTRAINT "subject_data_request_reference_unique" UNIQUE ("reference"),
  CONSTRAINT "subject_data_request_reason_valid" CHECK (
    "reason" IN ('full_copy','after_deletion','guest_orders','other')
  ),
  CONSTRAINT "subject_data_request_channel_valid" CHECK (
    "channel" IN ('support_form','email','post','phone','in_person','other')
  ),
  CONSTRAINT "subject_data_request_products_valid" CHECK (
    cardinality("products") >= 1 AND "products" <@ ARRAY['account','bid','shop']::text[]
  ),
  CONSTRAINT "subject_data_request_status_valid" CHECK (
    "status" IN ('waiting_for_id','in_progress','closed')
  ),
  CONSTRAINT "subject_data_request_clock_matches_status" CHECK (
    ("status" <> 'waiting_for_id' OR "due_on" IS NULL)
    AND ("status" <> 'in_progress' OR "due_on" IS NOT NULL)
    AND ("due_on" IS NULL) = ("clock_started_on" IS NULL)
  ),
  CONSTRAINT "subject_data_request_extension_whole" CHECK (
    ("extended_due_on" IS NULL) = ("extension_reason" IS NULL)
    AND ("extended_due_on" IS NULL) = ("extension_note" IS NULL)
    AND ("extended_due_on" IS NULL) = ("person_told_on" IS NULL)
    AND ("extended_due_on" IS NULL) = ("person_told_via" IS NULL)
  ),
  CONSTRAINT "subject_data_request_extension_limits" CHECK (
    "extended_due_on" IS NULL OR (
      "due_on" IS NOT NULL
      AND "extended_due_on" > "due_on"
      AND "extended_due_on" <= ("due_on" + interval '2 months')::date
      AND "person_told_on" <= "due_on"
    )
  ),
  CONSTRAINT "subject_data_request_outcome_valid" CHECK (
    "outcome" IS NULL OR "outcome" IN ('sent','sent_partial','nothing_held','refused','withdrawn')
  ),
  CONSTRAINT "subject_data_request_closed_has_outcome" CHECK (
    ("status" = 'closed') = ("outcome" IS NOT NULL)
    AND ("status" = 'closed') = ("closed_on" IS NOT NULL)
    AND ("status" = 'closed') = ("closed_by" IS NOT NULL)
  ),
  CONSTRAINT "subject_data_request_outcome_notes" CHECK (
    ("outcome" IS DISTINCT FROM 'sent_partial' OR "outcome_note" IS NOT NULL)
    AND ("outcome" IS DISTINCT FROM 'refused'
      OR ("outcome_note" IS NOT NULL AND "complaint_right_told" IS TRUE))
  )
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subject_data_request_open_due_idx"
  ON "subject_data_request" ("status", (coalesce("extended_due_on", "due_on")));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subject_data_request_subject_idx"
  ON "subject_data_request" ("subject_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subject_data_request_linked_export_uidx"
  ON "subject_data_request" ("linked_export_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subject_data_request_retention_idx"
  ON "subject_data_request" ("closed_on")
  WHERE "contact_cleared_at" IS NULL AND "status" = 'closed';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subject_data_request_audit" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "request_id" uuid NOT NULL REFERENCES "subject_data_request"("id") ON DELETE CASCADE,
  "actor_subject_id" text,
  "event" text NOT NULL,
  "detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subject_data_request_audit_request_idx"
  ON "subject_data_request_audit" ("request_id", "occurred_at");

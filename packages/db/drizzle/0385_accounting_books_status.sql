-- Zoho Books plan v2, PR 14: the nightly status check. LAX reads back from Books the documents it
-- issued there and records what changed by hand in Books since (a document voided or deleted, a
-- payment recorded there for a gallery sale or a cheque). Books is never trusted to move money in
-- LAX: these tables record what Books said, and a payment recorded only in Books becomes a finance
-- task (a domain event, as for other money LAX has not applied). Nothing here marks anything paid.
--
-- accounting_books_status: the last state read for each issued document (one row per document),
-- and when a Books notice asked for it to be read again. The worker inserts and updates it.
-- held_since maps each Books payment held back on the last read (a LAX payment on the invoice was
-- unresolved) to when it was first held (epoch milliseconds), so the hold ends after a few days.
-- accounting_books_status_change: what changed, append-only (a trigger refuses UPDATE, DELETE and
-- TRUNCATE for every role); a payment recorded by hand is held once per document and Books id.
-- accounting_books_status_run: one row per nightly run, so the watch can tell a missed run.
--
-- Grants (migrate-roles.ts): worker_app only, column by column for updates; api_app, shop_app and
-- auth_app get nothing. New, empty tables: no lock on existing ones beyond the foreign keys'.
CREATE TABLE IF NOT EXISTS "accounting_books_status" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "books_state" text,
  "balance_pence" bigint,
  "payment_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "checked_at" timestamp with time zone,
  "changed_at" timestamp with time zone,
  "recheck_requested_at" timestamp with time zone,
  "held_since" jsonb DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT "accounting_books_status_document_fkey"
    FOREIGN KEY ("document_id") REFERENCES "accounting_document"("id") ON DELETE RESTRICT,
  CONSTRAINT "accounting_books_status_state_ck" CHECK ("books_state" IS NULL OR "books_state" IN
    ('draft', 'open', 'overdue', 'partially_paid', 'paid', 'closed', 'recorded', 'void', 'other', 'missing')),
  CONSTRAINT "accounting_books_status_read_pair_ck"
    CHECK (("books_state" IS NULL) = ("checked_at" IS NULL)),
  CONSTRAINT "accounting_books_status_payment_ids_ck" CHECK (jsonb_typeof("payment_ids") = 'array'),
  CONSTRAINT "accounting_books_status_held_since_ck" CHECK (jsonb_typeof("held_since") = 'object')
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounting_books_status_recheck_idx"
  ON "accounting_books_status" ("recheck_requested_at")
  WHERE "recheck_requested_at" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounting_books_status_change" (
  "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY NOT NULL,
  "document_id" uuid NOT NULL,
  "change" text NOT NULL,
  "from_state" text,
  "to_state" text,
  "books_payment_id" text,
  "amount_pence" bigint,
  "observed_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "accounting_books_status_change_document_fkey"
    FOREIGN KEY ("document_id") REFERENCES "accounting_document"("id") ON DELETE RESTRICT,
  CONSTRAINT "accounting_books_status_change_kind_ck"
    CHECK ("change" IN ('state_changed', 'payment_recorded_in_books')),
  CONSTRAINT "accounting_books_status_change_shape_ck" CHECK (
    ("change" = 'state_changed' AND "to_state" IS NOT NULL AND "books_payment_id" IS NULL)
    OR ("change" = 'payment_recorded_in_books' AND "books_payment_id" ~ '^[0-9]{1,32}$'
        AND "amount_pence" IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "accounting_books_status_change_payment_uid"
  ON "accounting_books_status_change" ("document_id", "books_payment_id")
  WHERE "change" = 'payment_recorded_in_books';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounting_books_status_change_document_idx"
  ON "accounting_books_status_change" ("document_id", "observed_at");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "accounting_books_status_change_append_only"() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  RAISE EXCEPTION 'accounting_books_status_change is append-only (% refused)', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$fn$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "accounting_books_status_change_no_change" ON "accounting_books_status_change";
--> statement-breakpoint
CREATE TRIGGER "accounting_books_status_change_no_change"
  BEFORE UPDATE OR DELETE ON "accounting_books_status_change"
  FOR EACH ROW EXECUTE FUNCTION "accounting_books_status_change_append_only"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "accounting_books_status_change_no_truncate" ON "accounting_books_status_change";
--> statement-breakpoint
CREATE TRIGGER "accounting_books_status_change_no_truncate"
  BEFORE TRUNCATE ON "accounting_books_status_change"
  FOR EACH STATEMENT EXECUTE FUNCTION "accounting_books_status_change_append_only"();
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounting_books_status_run" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "started_at" timestamp with time zone NOT NULL,
  "finished_at" timestamp with time zone,
  "outcome" text,
  "checked" integer DEFAULT 0 NOT NULL,
  "changed" integer DEFAULT 0 NOT NULL,
  "tasks" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "accounting_books_status_run_outcome_ck" CHECK ("outcome" IS NULL OR "outcome" IN
    ('completed', 'budget_spent', 'rehearsal', 'failed')),
  CONSTRAINT "accounting_books_status_run_finished_pair_ck"
    CHECK (("finished_at" IS NULL) = ("outcome" IS NULL)),
  CONSTRAINT "accounting_books_status_run_counts_ck"
    CHECK ("checked" >= 0 AND "changed" >= 0 AND "tasks" >= 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounting_books_status_run_finished_idx"
  ON "accounting_books_status_run" ("finished_at");

-- LAX's own copy of the PDF a provider rendered for an accounting document it issued (a Bid
-- invoice today). The worker fetches the PDF once the document is issued (in dry run, once it is
-- rehearsed: a page that says it is a rehearsal), stores it in document storage under
-- `storage_key`, and records it here; buyers download this stored copy, never the provider's.
--
-- The "Your invoice" email is settled from the same row exactly once: either it was queued
-- (`email_queued_at` + `email_outbox_id`) or it was skipped for good (`email_skipped_at` +
-- `email_skip_reason`, e.g. the invoice was cancelled), never both. A trigger makes all four
-- columns write-once (NULL to a value, never changed or cleared), so the table itself keeps a copy
-- from being emailed twice through this row.
--
-- `no_rehearsal_email_ck` constrains the record, not the send: the worker enqueues the email before
-- it notes it here, so the CHECK cannot stop a message; it refuses to record a rehearsal as emailed
-- (the worker's query and service are what keep a rehearsal out of the outbox). Additive: a new
-- table nothing reads until the new release is running.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounting_document_copy" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "storage_key" text NOT NULL,
  "content_type" text DEFAULT 'application/pdf' NOT NULL,
  "byte_size" integer NOT NULL,
  "sha256" text NOT NULL,
  "rehearsal" boolean NOT NULL,
  "stored_at" timestamp with time zone DEFAULT now() NOT NULL,
  "email_queued_at" timestamp with time zone,
  "email_outbox_id" uuid,
  "email_skipped_at" timestamp with time zone,
  "email_skip_reason" text,
  CONSTRAINT "accounting_document_copy_document_fkey"
    FOREIGN KEY ("document_id") REFERENCES "accounting_document"("id") ON DELETE RESTRICT,
  CONSTRAINT "accounting_document_copy_storage_key_uq" UNIQUE ("storage_key"),
  CONSTRAINT "accounting_document_copy_content_type_ck" CHECK ("content_type" = 'application/pdf'),
  CONSTRAINT "accounting_document_copy_size_ck" CHECK ("byte_size" > 0 AND "byte_size" <= 10485760),
  CONSTRAINT "accounting_document_copy_sha256_ck" CHECK ("sha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "accounting_document_copy_email_pair_ck"
    CHECK (("email_queued_at" IS NULL) = ("email_outbox_id" IS NULL)),
  CONSTRAINT "accounting_document_copy_no_rehearsal_email_ck"
    CHECK (NOT ("rehearsal" AND "email_queued_at" IS NOT NULL)),
  CONSTRAINT "accounting_document_copy_email_skip_pair_ck"
    CHECK (("email_skipped_at" IS NULL) = ("email_skip_reason" IS NULL)),
  CONSTRAINT "accounting_document_copy_email_settled_once_ck"
    CHECK ("email_queued_at" IS NULL OR "email_skipped_at" IS NULL),
  CONSTRAINT "accounting_document_copy_email_skip_reason_ck"
    CHECK ("email_skip_reason" IS NULL OR "email_skip_reason" ~ '^[a-z_]{1,64}$')
);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "accounting_document_copy_email_write_once"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (OLD."email_queued_at" IS NOT NULL AND NEW."email_queued_at" IS DISTINCT FROM OLD."email_queued_at")
    OR (OLD."email_outbox_id" IS NOT NULL AND NEW."email_outbox_id" IS DISTINCT FROM OLD."email_outbox_id")
    OR (OLD."email_skipped_at" IS NOT NULL AND NEW."email_skipped_at" IS DISTINCT FROM OLD."email_skipped_at")
    OR (OLD."email_skip_reason" IS NOT NULL AND NEW."email_skip_reason" IS DISTINCT FROM OLD."email_skip_reason")
  THEN
    RAISE EXCEPTION 'accounting_document_copy email columns are write-once (document %)', OLD."document_id"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "accounting_document_copy_email_write_once_trg" ON "accounting_document_copy";
--> statement-breakpoint
CREATE TRIGGER "accounting_document_copy_email_write_once_trg"
  BEFORE UPDATE ON "accounting_document_copy"
  FOR EACH ROW EXECUTE FUNCTION "accounting_document_copy_email_write_once"();
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounting_document_copy_email_due_idx"
  ON "accounting_document_copy" ("stored_at")
  WHERE "email_queued_at" IS NULL AND "email_skipped_at" IS NULL AND NOT "rehearsal";

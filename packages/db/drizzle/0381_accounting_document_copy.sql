-- LAX's own copy of the PDF a provider rendered for an accounting document it issued (a Bid
-- invoice today). The worker fetches the PDF once the document is issued (in dry run, once it is
-- rehearsed: a page that says it is a rehearsal), stores it in document storage under
-- `storage_key`, and records it here; buyers download this stored copy, never the provider's. The
-- "Your invoice" email is queued from the same row, at most once (`email_queued_at`), and never for
-- a rehearsal (CHECK). Additive: a new table nothing reads until the new release is running.
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
  CONSTRAINT "accounting_document_copy_document_fkey"
    FOREIGN KEY ("document_id") REFERENCES "accounting_document"("id") ON DELETE RESTRICT,
  CONSTRAINT "accounting_document_copy_storage_key_uq" UNIQUE ("storage_key"),
  CONSTRAINT "accounting_document_copy_content_type_ck" CHECK ("content_type" = 'application/pdf'),
  CONSTRAINT "accounting_document_copy_size_ck" CHECK ("byte_size" > 0 AND "byte_size" <= 10485760),
  CONSTRAINT "accounting_document_copy_sha256_ck" CHECK ("sha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "accounting_document_copy_email_pair_ck"
    CHECK (("email_queued_at" IS NULL) = ("email_outbox_id" IS NULL)),
  CONSTRAINT "accounting_document_copy_no_rehearsal_email_ck"
    CHECK (NOT ("rehearsal" AND "email_queued_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounting_document_copy_email_due_idx"
  ON "accounting_document_copy" ("stored_at")
  WHERE "email_queued_at" IS NULL AND NOT "rehearsal";

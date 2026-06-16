CREATE TABLE IF NOT EXISTS "source_of_funds_document_review" (
  "document_id" uuid PRIMARY KEY NOT NULL REFERENCES "source_of_funds_document"("id") ON DELETE CASCADE,
  "source_of_funds_id" uuid NOT NULL REFERENCES "source_of_funds"("id") ON DELETE CASCADE,
  "reviewed_by_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "reviewed_at" timestamp with time zone NOT NULL,
  "checks" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "note" text
);

CREATE INDEX IF NOT EXISTS "source_of_funds_document_review_case_idx"
  ON "source_of_funds_document_review" ("source_of_funds_id");

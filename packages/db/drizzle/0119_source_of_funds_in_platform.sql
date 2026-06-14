ALTER TABLE "source_of_funds" ADD COLUMN IF NOT EXISTS "documents_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "source_of_funds" ADD COLUMN IF NOT EXISTS "documents_requested_by_user_id" text;--> statement-breakpoint
ALTER TABLE "source_of_funds" ADD COLUMN IF NOT EXISTS "document_request_note" text;--> statement-breakpoint
ALTER TABLE "source_of_funds" ADD COLUMN IF NOT EXISTS "requested_document_types" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "source_of_funds" ADD COLUMN IF NOT EXISTS "documents_submitted_at" timestamp with time zone;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "source_of_funds"
    ADD CONSTRAINT "source_of_funds_documents_requested_by_user_id_user_id_fk"
    FOREIGN KEY ("documents_requested_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "source_of_funds_document" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_of_funds_id" uuid NOT NULL,
  "upload_object_id" uuid NOT NULL,
  "requested_type" text NOT NULL,
  "label" text,
  "review_status" text DEFAULT 'pending' NOT NULL,
  "retention_class" text DEFAULT 'aml_5y' NOT NULL,
  "uploaded_by_user_id" text NOT NULL,
  "uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
  "superseded_at" timestamp with time zone,
  "anonymized_at" timestamp with time zone,
  CONSTRAINT "source_of_funds_document_source_of_funds_id_source_of_funds_id_fk"
    FOREIGN KEY ("source_of_funds_id") REFERENCES "public"."source_of_funds"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "source_of_funds_document_upload_object_id_upload_object_id_fk"
    FOREIGN KEY ("upload_object_id") REFERENCES "public"."upload_object"("id") ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "source_of_funds_document_uploaded_by_user_id_user_id_fk"
    FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "source_of_funds_document_case_idx" ON "source_of_funds_document" ("source_of_funds_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "source_of_funds_document_case_type_idx" ON "source_of_funds_document" ("source_of_funds_id", "requested_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "source_of_funds_document_retention_idx" ON "source_of_funds_document" ("retention_class", "anonymized_at") WHERE "anonymized_at" IS NULL;

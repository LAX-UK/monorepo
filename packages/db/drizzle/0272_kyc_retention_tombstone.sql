-- KYC, AML and source-of-funds retention: the audit tombstone the purge job leaves behind.
--   One row per subject and record kind: an opaque id, counts and dates, and no personal data.
--   Append-only; the worker may insert and read it and nothing else.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kyc_retention_tombstone" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "subject_kind" text NOT NULL,
  "subject_id" text NOT NULL,
  "record_kind" text NOT NULL,
  "records_purged" integer NOT NULL,
  "relationship_ended_at" timestamp with time zone NOT NULL,
  "retention_basis" text NOT NULL,
  "purged_at" timestamp with time zone NOT NULL,
  CONSTRAINT "kyc_retention_tombstone_subject_kind_check" CHECK ("subject_kind" IN ('person', 'legal_entity'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kyc_retention_tombstone_subject_idx"
  ON "kyc_retention_tombstone" ("subject_kind", "subject_id");

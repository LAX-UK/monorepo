-- Identity keeps the record of which Terms and Privacy notice a person accepted when they created
-- their LAX Account: one row per document, per company, per version, written as the account is
-- created and never edited. The company is the one whose documents the sign-up page linked
-- (London Auction Xchange LTD for LAX Bid and LAX Account, London Art Exchange Ltd for LAX Shop and
-- lax.art). A later version a person accepts is a new row.
-- The row holds no name or contact detail, so it stays when the account is erased; the erasure
-- scrub leaves the user row in place, and the restrictive foreign key keeps it that way.
-- Additive: one new table, so the running services keep working until they restart.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subject_legal_acceptance" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "subject_id" text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "document_kind" text NOT NULL,
  "document_version" text NOT NULL,
  "document_effective_on" date NOT NULL,
  "legal_entity" text NOT NULL,
  "product" text NOT NULL,
  "source" text NOT NULL,
  "accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "subject_legal_acceptance_kind_valid" CHECK (
    "document_kind" IN ('terms','privacy')
  ),
  CONSTRAINT "subject_legal_acceptance_entity_valid" CHECK (
    "legal_entity" IN ('london-auction-xchange','london-art-exchange')
  ),
  CONSTRAINT "subject_legal_acceptance_product_valid" CHECK (
    "product" IN ('account','bid','shop','art')
  ),
  CONSTRAINT "subject_legal_acceptance_source_valid" CHECK (
    "source" IN ('hosted_sign_up','social_sign_up')
  ),
  CONSTRAINT "subject_legal_acceptance_version_present" CHECK (length("document_version") > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subject_legal_acceptance_document_uidx"
  ON "subject_legal_acceptance" ("subject_id", "legal_entity", "document_kind", "document_version");

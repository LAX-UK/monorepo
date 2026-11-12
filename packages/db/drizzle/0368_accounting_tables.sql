-- Persistence for the accounting domain (packages/accounting-domain): the documents to send to the
-- accounting provider, the history of what happened to each, and the per-product source switch.
-- Dry-run foundation: nothing reads or writes these tables yet and no provider is called.
-- The CHECK constraints mirror the domain's life cycle (one shape per status), so a combination
-- the domain cannot express cannot be stored either.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounting_document" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product" text NOT NULL,
  "legal_entity" text NOT NULL,
  "kind" text NOT NULL,
  "lax_reference" text NOT NULL,
  "source_event_ref" text NOT NULL,
  "payload" jsonb NOT NULL,
  "net_pence" bigint NOT NULL,
  "vat_pence" bigint NOT NULL,
  "gross_pence" bigint NOT NULL,
  "state" text DEFAULT 'pending' NOT NULL,
  "provider" text,
  "provider_id" text,
  "provider_number" text,
  "pdf_ref" text,
  "lease_token" text,
  "lease_expires_at" timestamp with time zone,
  "settles_at" timestamp with time zone,
  "review_lookup" text,
  "mismatch_field" text,
  "mismatch_difference_pence" bigint,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_error_class" text,
  "needs_review_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "accounting_document_product_ck" CHECK ("product" IN ('bid', 'shop', 'lax_art')),
  CONSTRAINT "accounting_document_kind_ck"
    CHECK ("kind" IN ('invoice', 'payment', 'credit_note', 'bill', 'contact')),
  CONSTRAINT "accounting_document_entity_ck" CHECK (
    ("product" = 'bid' AND "legal_entity" = 'london_auction_xchange')
    OR ("product" <> 'bid' AND "legal_entity" = 'london_art_exchange')
  ),
  CONSTRAINT "accounting_document_reference_ck" CHECK (
    "lax_reference" ~ '^LAX-(BID|SHOP|ART)-(INV|PAY|CN|BILL|CON)-[a-z0-9][a-z0-9_-]{0,63}$'
    AND "lax_reference" LIKE 'LAX-' || CASE "product"
      WHEN 'bid' THEN 'BID' WHEN 'shop' THEN 'SHOP' ELSE 'ART' END
      || '-' || CASE "kind"
      WHEN 'invoice' THEN 'INV' WHEN 'payment' THEN 'PAY' WHEN 'credit_note' THEN 'CN'
      WHEN 'bill' THEN 'BILL' ELSE 'CON' END || '-%'
  ),
  CONSTRAINT "accounting_document_source_event_ck" CHECK ("source_event_ref" <> ''),
  CONSTRAINT "accounting_document_payload_ck" CHECK (jsonb_typeof("payload") = 'object'),
  -- Totals as the domain holds them: gross is net plus VAT; a contact has no money and every
  -- other kind is refused at zero; a payment carries no VAT.
  CONSTRAINT "accounting_document_totals_ck" CHECK (
    "net_pence" >= 0 AND "vat_pence" >= 0 AND "gross_pence" = "net_pence" + "vat_pence"
    AND (("kind" = 'contact') = ("gross_pence" = 0 AND "net_pence" = 0))
    AND ("kind" <> 'payment' OR "vat_pence" = 0)
  ),
  CONSTRAINT "accounting_document_state_ck" CHECK (
    "state" IN ('pending', 'sending', 'issued', 'unknown', 'needs_review', 'failed', 'cancelled')
  ),
  CONSTRAINT "accounting_document_provider_ck" CHECK ("provider" IS NULL OR "provider" IN ('xero', 'books')),
  -- Lookup before retry must ask the provider the first request went to, so a row that was or may
  -- have been sent always names it. The claim stamps the provider as it leases the document.
  CONSTRAINT "accounting_document_provider_sent_ck" CHECK (
    "provider" IS NOT NULL
    OR ("attempts" = 0 AND "state" IN ('pending', 'cancelled'))
  ),
  CONSTRAINT "accounting_document_attempts_ck" CHECK ("attempts" >= 0),
  -- Only a sending document holds a lease, and a lease is a token with an expiry.
  CONSTRAINT "accounting_document_lease_ck" CHECK (
    ("state" = 'sending') = ("lease_token" IS NOT NULL)
    AND ("lease_token" IS NULL) = ("lease_expires_at" IS NULL)
    AND ("lease_token" IS NULL OR "lease_token" <> '')
  ),
  -- The provider's document: number and id together, only on an issued record or one in review.
  CONSTRAINT "accounting_document_provider_document_ck" CHECK (
    ("provider_id" IS NULL) = ("provider_number" IS NULL)
    AND ("provider_id" IS NULL OR ("provider_id" <> '' AND "provider_number" <> ''))
    AND ("state" <> 'issued' OR "provider_id" IS NOT NULL)
    AND ("provider_id" IS NULL OR "state" IN ('issued', 'needs_review'))
    AND ("provider_id" IS NULL OR "provider" IS NOT NULL)
    AND ("pdf_ref" IS NULL OR "provider_id" IS NOT NULL)
  ),
  -- A lookup is owed from unknown and from needs_review(owed); both know when the first request settles.
  CONSTRAINT "accounting_document_settle_ck" CHECK (
    ("settles_at" IS NOT NULL) = (
      "state" = 'unknown' OR ("state" = 'needs_review' AND "review_lookup" = 'owed')
    )
  ),
  CONSTRAINT "accounting_document_review_ck" CHECK (
    ("state" = 'needs_review') = ("review_lookup" IS NOT NULL)
    AND ("state" = 'needs_review') = ("needs_review_reason" IS NOT NULL)
    AND ("review_lookup" IS NULL OR "review_lookup" IN ('owed', 'clear'))
    AND ("needs_review_reason" IS NULL OR "needs_review_reason" <> '')
    AND ("review_lookup" IS DISTINCT FROM 'owed' OR "provider_id" IS NULL)
  ),
  -- A totals mismatch exists only beside the provider's document, once nothing is owed.
  CONSTRAINT "accounting_document_mismatch_ck" CHECK (
    ("mismatch_field" IS NULL) = ("mismatch_difference_pence" IS NULL)
    AND ("mismatch_field" IS NULL OR "mismatch_field" IN ('netPence', 'vatPence', 'grossPence'))
    AND ("mismatch_field" IS NULL OR ("provider_id" IS NOT NULL AND "review_lookup" IS NOT DISTINCT FROM 'clear'))
    AND ("mismatch_difference_pence" IS NULL OR "mismatch_difference_pence" <> 0)
  ),
  CONSTRAINT "accounting_document_failed_ck" CHECK (
    "state" <> 'failed' OR ("last_error_class" IS NOT NULL AND "last_error_class" <> '')
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "accounting_document_reference_uid"
  ON "accounting_document" ("product", "legal_entity", "lax_reference");
--> statement-breakpoint
-- The worker claims the oldest document it may act on: pending, or a sending one whose lease ran out.
CREATE INDEX IF NOT EXISTS "accounting_document_claim_idx"
  ON "accounting_document" ("created_at", "id") WHERE "state" IN ('pending', 'sending');
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounting_document_state_idx" ON "accounting_document" ("state", "updated_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounting_document_event" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "document_id" uuid NOT NULL REFERENCES "accounting_document" ("id") ON DELETE RESTRICT,
  "action" text NOT NULL,
  "from_state" text,
  "to_state" text NOT NULL,
  "attempts" integer NOT NULL,
  "detail" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "occurred_at" timestamp with time zone NOT NULL,
  CONSTRAINT "accounting_document_event_action_ck" CHECK (
    "action" IN ('created', 'start_sending', 'expire_lease', 'complete_sending', 'apply_lookup',
      'escalate', 'requeue', 'cancel')
  ),
  CONSTRAINT "accounting_document_event_state_ck" CHECK (
    "to_state" IN ('pending', 'sending', 'issued', 'unknown', 'needs_review', 'failed', 'cancelled')
    AND ("from_state" IS NULL OR "from_state" IN
      ('pending', 'sending', 'issued', 'unknown', 'needs_review', 'failed', 'cancelled'))
    AND (("action" = 'created') = ("from_state" IS NULL))
  ),
  CONSTRAINT "accounting_document_event_attempts_ck" CHECK ("attempts" >= 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounting_document_event_document_idx"
  ON "accounting_document_event" ("document_id", "id");
--> statement-breakpoint
-- History is never edited or removed, by any role, the owner included.
CREATE OR REPLACE FUNCTION "accounting_document_event_append_only"() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  RAISE EXCEPTION 'accounting_document_event is append-only (% refused)', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$fn$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "accounting_document_event_no_change" ON "accounting_document_event";
--> statement-breakpoint
CREATE TRIGGER "accounting_document_event_no_change"
  BEFORE UPDATE OR DELETE ON "accounting_document_event"
  FOR EACH ROW EXECUTE FUNCTION "accounting_document_event_append_only"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "accounting_document_event_no_truncate" ON "accounting_document_event";
--> statement-breakpoint
CREATE TRIGGER "accounting_document_event_no_truncate"
  BEFORE TRUNCATE ON "accounting_document_event"
  FOR EACH STATEMENT EXECUTE FUNCTION "accounting_document_event_append_only"();
--> statement-breakpoint
-- One row per product. Each provider has a mode; at most one may be live (the domain's rule, held
-- by the database too). `live_source` is derived so readers need not repeat the rule.
CREATE TABLE IF NOT EXISTS "accounting_source_setting" (
  "product" text PRIMARY KEY NOT NULL,
  "xero_mode" text NOT NULL DEFAULT 'off',
  "books_mode" text NOT NULL DEFAULT 'off',
  "live_source" text GENERATED ALWAYS AS (
    CASE WHEN "xero_mode" = 'live' THEN 'xero' WHEN "books_mode" = 'live' THEN 'books' ELSE 'none' END
  ) STORED NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_by" text,
  CONSTRAINT "accounting_source_setting_product_ck" CHECK ("product" IN ('bid', 'shop', 'lax_art')),
  CONSTRAINT "accounting_source_setting_xero_mode_ck"
    CHECK ("xero_mode" IN ('off', 'dry_run', 'test_org', 'live')),
  CONSTRAINT "accounting_source_setting_books_mode_ck"
    CHECK ("books_mode" IN ('off', 'dry_run', 'test_org', 'live')),
  CONSTRAINT "accounting_source_setting_one_live_ck"
    CHECK (NOT ("xero_mode" = 'live' AND "books_mode" = 'live'))
);
--> statement-breakpoint
-- Today's reality: LAX Bid invoices go to Xero (the existing finance path writes there unless
-- XERO_API_WRITES_DISABLED is set), Shop and lax.art have no provider. Books is off everywhere.
INSERT INTO "accounting_source_setting" ("product", "xero_mode", "books_mode") VALUES
  ('bid', 'live', 'off'),
  ('shop', 'off', 'off'),
  ('lax_art', 'off', 'off')
ON CONFLICT ("product") DO NOTHING;

-- Rollback for 0382_accounting_parked_documents. Roll back the release first, then this.
-- It restores 0379's requeue rules for api_app (which do not know parked documents or releases),
-- 0368's `provider_sent_ck` and history actions, and takes back api_app's UPDATE on the document
-- and its totals (granted for the release alone; the earlier release's requeue rule does not
-- guard them). The CHECKs are added back NOT VALID, so rows and history already stored stay as
-- they are while nothing new of this kind can be written by the earlier release. Also removes this
-- migration's ledger row so a later deploy reapplies it.
BEGIN;

SET LOCAL lock_timeout = '5s';
ALTER TABLE "accounting_document" DROP CONSTRAINT IF EXISTS "accounting_document_provider_sent_ck";
ALTER TABLE "accounting_document" ADD CONSTRAINT "accounting_document_provider_sent_ck" CHECK (
  "provider" IS NOT NULL
  OR ("attempts" = 0 AND "state" IN ('pending', 'cancelled'))
) NOT VALID;
ALTER TABLE "accounting_document_event" DROP CONSTRAINT IF EXISTS "accounting_document_event_action_ck";
ALTER TABLE "accounting_document_event" ADD CONSTRAINT "accounting_document_event_action_ck" CHECK (
  "action" IN ('created', 'start_sending', 'expire_lease', 'complete_sending', 'apply_lookup',
    'escalate', 'requeue', 'cancel')
) NOT VALID;
CREATE OR REPLACE FUNCTION "accounting_document_api_requeue_only"() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF current_user <> 'api_app' THEN
    RETURN NEW;
  END IF;
  IF NOT COALESCE((
    (OLD."state" = 'failed'
      OR (OLD."state" = 'needs_review' AND OLD."review_lookup" = 'clear' AND OLD."provider_id" IS NULL))
    AND NEW."state" = 'pending'
    AND NEW."attempts" = OLD."attempts"
    AND NEW."last_error_class" IS NOT DISTINCT FROM OLD."last_error_class"
    AND NEW."lease_token" IS NULL AND NEW."lease_expires_at" IS NULL
    AND NEW."settles_at" IS NULL
    AND NEW."review_lookup" IS NULL AND NEW."needs_review_reason" IS NULL
    AND NEW."provider_id" IS NULL AND NEW."provider_number" IS NULL AND NEW."pdf_ref" IS NULL
    AND NEW."mismatch_field" IS NULL AND NEW."mismatch_difference_pence" IS NULL
  ), false) THEN
    RAISE EXCEPTION 'api_app may only requeue a failed or cleared document to pending'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$fn$;
CREATE OR REPLACE FUNCTION "accounting_document_event_api_requeue_only"() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF current_user <> 'api_app' THEN
    RETURN NEW;
  END IF;
  IF NOT COALESCE((
    NEW."action" = 'requeue'
    AND NEW."from_state" IN ('failed', 'needs_review')
    AND NEW."to_state" = 'pending'
    AND jsonb_typeof(NEW."detail" -> 'requestedBy') = 'string'
    AND NEW."detail" ->> 'requestedBy' <> ''
    AND NEW."detail" - 'requestedBy' = '{}'::jsonb
    AND EXISTS (
      SELECT 1 FROM "accounting_document" d
       WHERE d."id" = NEW."document_id" AND d."state" = 'pending' AND d."attempts" = NEW."attempts"
    )
  ), false) THEN
    RAISE EXCEPTION 'api_app may only record a requeue, with who asked for it'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$fn$;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'api_app') THEN
    REVOKE UPDATE ("payload", "net_pence", "vat_pence", "gross_pence")
      ON "accounting_document" FROM api_app;
  END IF;
END
$$;

DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1811160000000;

COMMIT;

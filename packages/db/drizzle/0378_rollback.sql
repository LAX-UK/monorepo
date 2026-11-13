-- Rollback for 0378_accounting_requeue_guard. Roll back the release first, then this.
-- It removes the triggers that hold the Bid API role to the requeue move; the column grants from
-- db:roles still apply. No data is changed. Also removes this migration's ledger row so a later
-- deploy reapplies it.
BEGIN;

SET LOCAL lock_timeout = '5s';
DROP TRIGGER IF EXISTS "accounting_document_event_api_requeue_only" ON "accounting_document_event";
DROP TRIGGER IF EXISTS "accounting_document_api_requeue_only" ON "accounting_document";
DROP FUNCTION IF EXISTS "accounting_document_event_api_requeue_only"();
DROP FUNCTION IF EXISTS "accounting_document_api_requeue_only"();

DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1810814400000;

COMMIT;

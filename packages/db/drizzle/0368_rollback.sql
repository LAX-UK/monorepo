-- Rollback for 0368_accounting_tables. Nothing in the application reads these tables yet, so roll
-- back the release first, then this. The documents, their history and the switch settings are
-- deleted with the tables; the dry-run documents can be built again from the source events.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
DROP TABLE IF EXISTS "accounting_document_event";
--> statement-breakpoint
DROP FUNCTION IF EXISTS "accounting_document_event_append_only"();
--> statement-breakpoint
DROP TABLE IF EXISTS "accounting_document";
--> statement-breakpoint
DROP TABLE IF EXISTS "accounting_source_setting";

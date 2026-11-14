-- Rollback for 0385_accounting_books_status. Drops the nightly status check's tables (what Books
-- said is lost; the finance tasks it opened are domain events and stay). Also removes this
-- migration's ledger row so a later deploy reapplies it. Stop the worker's accounting-reconcile
-- job first. It does not depend on 0384.
BEGIN;

SET LOCAL lock_timeout = '5s';
DROP TABLE IF EXISTS "accounting_books_status_run";
DROP TABLE IF EXISTS "accounting_books_status_change";
DROP FUNCTION IF EXISTS "accounting_books_status_change_append_only"();
DROP TABLE IF EXISTS "accounting_books_status";

DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1811419200000;

COMMIT;

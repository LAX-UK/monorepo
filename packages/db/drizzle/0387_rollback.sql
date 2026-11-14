-- Rollback for 0387_accounting_books_status. Drops the nightly status check's tables (what Books
-- said is lost; the finance tasks it opened are domain events and stay). Also removes this
-- migration's ledger row so a later deploy reapplies it. Stop the worker's accounting-books-status
-- job first. It does not depend on 0385 or 0386.
BEGIN;

SET LOCAL lock_timeout = '5s';
DROP TABLE IF EXISTS "accounting_books_status_run";
DROP TABLE IF EXISTS "accounting_books_status_change";
DROP FUNCTION IF EXISTS "accounting_books_status_change_append_only"();
DROP TABLE IF EXISTS "accounting_books_status";

DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1811592000000;

COMMIT;

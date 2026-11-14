-- Rollback for 0386_accounting_shop_refunds. Roll the release back first, then this.
-- api_app's rule is left as 0386 made it, with the refusal kept (as 0385's rollback kept its own):
-- a Shop refund's credit note parked until its account is named stays parked and is never moved
-- by api_app while the earlier release, which knows nothing of it, runs. Restoring 0385's
-- function, if ever needed, is that function from 0385_accounting_credit_note_refunds.sql, and
-- then such notes could be released unchanged by api_app: do not, while any is parked.
-- Credit notes are not touched. Removes this migration's ledger row so a later deploy reapplies
-- it (the function is replaced with the same body).
BEGIN;

DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1811505600000;

COMMIT;

-- Rollback for 0381_accounting_document_copy. Roll the release back first: nothing may still read or
-- write the table. The stored PDFs stay in document storage under `accounting/` (delete them there
-- if they are not wanted); only the record of them and of the queued emails goes. Emails already
-- queued are in the email outbox and are not affected.
BEGIN;

SET LOCAL lock_timeout = '5s';
DROP TABLE IF EXISTS "accounting_document_copy";

COMMIT;

-- Rollback for 0369_zoho_books_connection. Roll back the application release first: the previous
-- release neither reads nor writes the table. Dropping it loses the sealed tokens, so every Books
-- organisation must be authorised again once the migration is re-applied.
SET LOCAL lock_timeout = '30s';

DROP TABLE IF EXISTS "zoho_books_connection";

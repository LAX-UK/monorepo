-- Erasing an account finds the person's other mail by the hash of the address it was sent to, and
-- reporting finds a recipient's recent mail the same way. Without an index each lookup reads the
-- whole mail queue.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_outbox_to_email_hash_idx" ON "email_outbox" ("to_email_hash");

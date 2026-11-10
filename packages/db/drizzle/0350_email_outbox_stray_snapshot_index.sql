-- The daily snapshot purge also clears an address kept on a row that has no deadline (one written
-- before deadlines were set). That is a handful of rows, so the index covers only them and the
-- purge does not read the whole mail queue to find them.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_outbox_stray_snapshot_idx" ON "email_outbox" ("created_at") WHERE "to_snapshot" IS NOT NULL AND "to_snapshot_purge_at" IS NULL;
